import { useCallback, useEffect, useRef, useState } from 'react';
import { loadGoogleMapsJs, GM_AUTH_EVENT } from '../lib/loadGoogleMapsJs';
import { isGoogleMapsJavaScriptBlockingMessage, isReliableGpsLatLng } from '../lib/googleMapsConfig';
import './LiveUserGoogleMap.css';

/** Google default pin: prefer live GPS, else last throttled center, else map fallback. */
function resolveMarkerPosition(mapCenter, fallbackCenter, hasFix) {
  if (hasFix && mapCenter && isReliableGpsLatLng(mapCenter.lat, mapCenter.lng)) {
    return { lat: mapCenter.lat, lng: mapCenter.lng };
  }
  if (mapCenter && isReliableGpsLatLng(mapCenter.lat, mapCenter.lng)) {
    return { lat: mapCenter.lat, lng: mapCenter.lng };
  }
  if (fallbackCenter && isReliableGpsLatLng(fallbackCenter.lat, fallbackCenter.lng)) {
    return { lat: fallbackCenter.lat, lng: fallbackCenter.lng };
  }
  return null;
}

function applyUserLocationGraphics(map, markerRef, mapCenter, fallbackCenter, hasFix) {
  const G = typeof window !== 'undefined' ? window.google : null;
  if (!G?.maps) return;

  const pos = resolveMarkerPosition(mapCenter, fallbackCenter, hasFix);
  if (!pos) {
    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
    return;
  }

  if (!markerRef.current) {
    markerRef.current = new G.maps.Marker({
      position: pos,
      map,
      optimized: true,
      zIndex: 999,
    });
  } else {
    markerRef.current.setPosition(pos);
    markerRef.current.setMap(map);
  }
}

/**
 * Interactive roadmap + Google’s default place marker (no custom icon or overlay shapes).
 */
export default function LiveUserGoogleMap({
  mapCenter,
  fallbackCenter,
  hasFix,
  accurate: _accurate = true,
  accuracyM: _accuracyM = null,
  onLoadError,
  className = '',
  zoomWithFix = 15,
  zoomFallback = 14,
  /** When false, no GPS dot / default marker (e.g. route + pins already shown). */
  showUserLocationMarker = true,
}) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const cancelledRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const blockedReportedRef = useRef(false);

  const onLoadErrorRef = useRef(onLoadError);
  onLoadErrorRef.current = onLoadError;

  const signalMapsBlocked = useCallback(() => {
    if (blockedReportedRef.current) return;
    blockedReportedRef.current = true;
    onLoadErrorRef.current?.();
  }, []);

  useEffect(() => {
    const fromRejection = (ev) => {
      const r = ev?.reason;
      const text = (typeof r === 'string' ? r : r?.stack) || r?.message || '';
      if (isGoogleMapsJavaScriptBlockingMessage(text)) signalMapsBlocked();
    };
    const fromError = (ev) => {
      const text = ev?.message || ev?.error?.stack || '';
      if (!text) return;
      const fromMapsScript =
        /maps\.googleapis\.com|gstatic\.com\/maps|Google Maps JavaScript API error/i.test(
          `${text} ${ev?.filename || ''}`,
        );
      if (fromMapsScript && isGoogleMapsJavaScriptBlockingMessage(text)) signalMapsBlocked();
    };
    const onGmAuth = () => signalMapsBlocked();
    window.addEventListener('unhandledrejection', fromRejection);
    window.addEventListener('error', fromError);
    window.addEventListener(GM_AUTH_EVENT, onGmAuth);
    return () => {
      window.removeEventListener('unhandledrejection', fromRejection);
      window.removeEventListener('error', fromError);
      window.removeEventListener(GM_AUTH_EVENT, onGmAuth);
    };
  }, [signalMapsBlocked]);

  useEffect(() => {
    cancelledRef.current = false;
    const el = elRef.current;
    if (!el) return undefined;

    loadGoogleMapsJs()
      .then((google) => {
        if (cancelledRef.current || !el) return;
        const center = mapCenter || fallbackCenter;
        const map = new google.maps.Map(el, {
          center,
          zoom: hasFix && mapCenter ? zoomWithFix : zoomFallback,
          disableDefaultUI: true,
          gestureHandling: 'greedy',
          clickableIcons: false,
        });
        mapRef.current = map;
        setMapReady(true);
      })
      .catch((err) => {
        console.error('[LiveUserGoogleMap] Maps JavaScript API failed to load', err);
        signalMapsBlocked();
      });

    return () => {
      cancelledRef.current = true;
      setMapReady(false);
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
      if (el) el.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once; updates handled below
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps) return;
    const map = mapRef.current;
    const center =
      hasFix && mapCenter && isReliableGpsLatLng(mapCenter.lat, mapCenter.lng) ? mapCenter : fallbackCenter;
    map.setCenter(center);
    map.setZoom(hasFix && mapCenter ? zoomWithFix : zoomFallback);
    if (showUserLocationMarker) {
      applyUserLocationGraphics(map, markerRef, mapCenter, fallbackCenter, hasFix);
    } else if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
  }, [mapReady, mapCenter, fallbackCenter, hasFix, zoomWithFix, zoomFallback, showUserLocationMarker]);

  const rootClass = ['ing-live-map__js', className].filter(Boolean).join(' ');
  return <div ref={elRef} className={rootClass} role="presentation" aria-hidden />;
}
