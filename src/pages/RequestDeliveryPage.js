import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GoogleMapEmbed from '../components/GoogleMapEmbed';
import LiveUserGoogleMap from '../components/LiveUserGoogleMap';
import LocationPermissionPrompt from '../components/LocationPermissionPrompt';
import LiveUserMapPuck from '../components/LiveUserMapPuck';
import { useLiveLocation } from '../hooks/useLiveLocation';
import {
  getGoogleMapsApiKey,
  publicDirectionsCoordsMapUrl,
  publicPlaceMapUrl,
  publicViewMapUrl,
} from '../lib/googleMapsConfig';
import {
  geolocationFailureMessage,
  pickupLineFromCoords,
} from '../lib/devicePickupLocation';
import { forwardGeocodeAddress } from '../lib/reverseGeocode';
import { estimateRoadKm, haversineKm } from '../lib/routeEstimate';
import AddressSuggestInput from '../components/AddressSuggestInput';
import './requestFlow.css';

const LONDON_CENTER = { lat: 51.5074, lng: -0.1278 };

function BackArrow() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15.5 18.5L8.5 12l7-7.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GpsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <circle cx="12" cy="12" r="4.5" strokeWidth="1.3" fill="none" />
      <path d="M12 3.5V7M12 17v3.5M3.5 12H7M17 12h3.5" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function MapPinA() {
  return (
    <svg viewBox="0 0 32 40" width="36" height="44" aria-hidden>
      <path
        d="M16 2.5C10.2 2.5 5.5 7.1 5.5 12.6c0 4.6 2.1 6.1 3.1 7.1l7.4 9.1 7.4-9.1c1-1.1 3-2.3 3-7.1C26.4 7.1 21.7 2.5 16 2.5Z"
        fill="#F18631"
      />
      <circle cx="16" cy="12" r="4" fill="white" />
    </svg>
  );
}
function MapPinB() {
  return (
    <svg viewBox="0 0 32 40" width="36" height="44" aria-hidden>
      <path
        d="M16 2.5C10.2 2.5 5.5 7.1 5.5 12.6c0 4.6 2.1 6.1 3.1 7.1l7.4 9.1 7.4-9.1c1-1.1 3-2.3 3-7.1C26.4 7.1 21.7 2.5 16 2.5Z"
        fill="#e53935"
      />
      <circle cx="16" cy="12" r="4" fill="white" />
    </svg>
  );
}

function createStop() {
  return { id: `${Date.now()}-${Math.random()}` };
}

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export default function RequestDeliveryPage() {
  const navigate = useNavigate();
  const live = useLiveLocation({ mapThrottleMs: 4000 });
  const hasMapsKey = Boolean(getGoogleMapsApiKey());
  const [deliveryJsMapFailed, setDeliveryJsMapFailed] = useState(false);
  const [pickup, setPickup] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsNotice, setGpsNotice] = useState('');
  const [stops, setStops] = useState([createStop()]);

  const setAt = (i, v) => {
    setStops((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], value: v };
      return next;
    });
  };

  const [routeDistanceKm, setRouteDistanceKm] = useState(null);

  const onContinue = async (e) => {
    e.preventDefault();
    const p = pickup.trim();
    const stopTexts = stops.map((s) => String(s?.value ?? '').trim()).filter(Boolean);
    const drop = stopTexts[stopTexts.length - 1] || '';
    let km = routeDistanceKm;
    if (km == null && p && drop) {
      try {
        const pickupGeo = await forwardGeocodeAddress(p);
        const destGeo = await forwardGeocodeAddress(drop);
        const middleTexts = stopTexts.length > 1 ? stopTexts.slice(0, -1) : [];
        if (pickupGeo && destGeo) {
          let straight = 0;
          let prev = { lat: pickupGeo.lat, lng: pickupGeo.lng };
          for (const t of middleTexts) {
            const wp = await forwardGeocodeAddress(t);
            if (!wp) {
              straight = null;
              break;
            }
            const h = haversineKm(prev.lat, prev.lng, wp.lat, wp.lng);
            if (h == null) {
              straight = null;
              break;
            }
            straight += h;
            prev = { lat: wp.lat, lng: wp.lng };
          }
          if (straight != null) {
            const hLast = haversineKm(prev.lat, prev.lng, destGeo.lat, destGeo.lng);
            if (hLast != null) straight += hLast;
            else straight = null;
          }
          if (straight != null) {
            const road = estimateRoadKm(straight);
            if (road != null) km = road;
          }
        }
      } catch {
        /* keep km null */
      }
    }
    const distanceKm =
      km != null && Number.isFinite(km) && km > 0 ? Math.round(km * 100) / 100 : 4.2;
    navigate('/package-details', {
      state: { pickup, stops, distanceKm },
    });
  };

  const debouncedPickup = useDebouncedValue(pickup.trim(), 320);
  const debouncedStops = useDebouncedValue(stops, 320);

  const [coordsRouteSrc, setCoordsRouteSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    const p = debouncedPickup.trim();
    const stopTexts = debouncedStops.map((s) => (s?.value ?? '').trim()).filter(Boolean);
    if (!p || stopTexts.length < 1) {
      setCoordsRouteSrc('');
      setRouteDistanceKm(null);
      return undefined;
    }

    const destinationText = stopTexts[stopTexts.length - 1];
    const middleTexts = stopTexts.length > 1 ? stopTexts.slice(0, -1) : [];

    (async () => {
      try {
        const pickupGeo = await forwardGeocodeAddress(p);
        const destGeo = await forwardGeocodeAddress(destinationText);
        if (cancelled || !pickupGeo || !destGeo) {
          if (!cancelled) {
            setCoordsRouteSrc('');
            setRouteDistanceKm(null);
          }
          return;
        }

        let waypointPairs = [];
        if (middleTexts.length) {
          const midGeos = await Promise.all(middleTexts.map((t) => forwardGeocodeAddress(t)));
          waypointPairs = midGeos.filter(Boolean).map((g) => [g.lat, g.lng]);
        }

        let straight = 0;
        let prev = { lat: pickupGeo.lat, lng: pickupGeo.lng };
        for (const pair of waypointPairs) {
          const h = haversineKm(prev.lat, prev.lng, pair[0], pair[1]);
          if (h == null) {
            straight = null;
            break;
          }
          straight += h;
          prev = { lat: pair[0], lng: pair[1] };
        }
        if (straight != null) {
          const hLast = haversineKm(prev.lat, prev.lng, destGeo.lat, destGeo.lng);
          if (hLast != null) straight += hLast;
          else straight = null;
        }
        const roadKm = straight != null ? estimateRoadKm(straight) : null;
        if (!cancelled) setRouteDistanceKm(roadKm != null && roadKm > 0 ? roadKm : null);

        const url = publicDirectionsCoordsMapUrl(
          pickupGeo.lat,
          pickupGeo.lng,
          destGeo.lat,
          destGeo.lng,
          waypointPairs,
        );
        if (!cancelled) setCoordsRouteSrc(url || '');
      } catch {
        if (!cancelled) {
          setCoordsRouteSrc('');
          setRouteDistanceKm(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedPickup, debouncedStops]);

  const textFallbackMapSrc = useMemo(() => {
    const stopTexts = debouncedStops.map((s) => (s?.value ?? '').trim()).filter(Boolean);
    const dropFirst = stopTexts[0] ?? '';
    const p = debouncedPickup.trim();

    if (p && stopTexts.length >= 1) {
      // Avoid flaky text-only directions embeds while coordinate route resolves (see coordsRouteSrc).
      return publicPlaceMapUrl(p);
    }
    if (p) return publicPlaceMapUrl(p);
    if (dropFirst) return publicPlaceMapUrl(dropFirst);
    const c = live.mapCenter;
    if (c && typeof c.lat === 'number' && typeof c.lng === 'number') {
      return publicViewMapUrl(c.lat, c.lng, 14);
    }
    return publicViewMapUrl(LONDON_CENTER.lat, LONDON_CENTER.lng, 12);
  }, [debouncedPickup, debouncedStops, live.mapCenter]);

  const requestMapSrc = coordsRouteSrc || textFallbackMapSrc;

  const hasPickupAndDropoff =
    pickup.trim().length > 0 && (stops[0]?.value ?? '').trim().length > 0;

  const deliveryInteractiveMapCenter = useMemo(() => {
    if (live.hasFix && live.lat != null && live.lng != null) {
      return { lat: live.lat, lng: live.lng };
    }
    return live.mapCenter;
  }, [live.hasFix, live.lat, live.lng, live.mapCenter]);

  const useDeliveryInteractiveMap = hasMapsKey && !deliveryJsMapFailed && !coordsRouteSrc;

  const useGps = async () => {
    if (gpsLoading) return;
    setGpsNotice('');
    setGpsLoading(true);
    try {
      const coords = await live.refreshFromUserGesture();
      const line = await pickupLineFromCoords(coords.latitude, coords.longitude);
      setPickup(line);
    } catch (err) {
      const code = typeof err?.code === 'number' ? err.code : 2;
      setGpsNotice(geolocationFailureMessage(code));
    } finally {
      setGpsLoading(false);
    }
  };

  return (
    <div className="flow-screen">
      <div className="flow-topbar">
        <Link to="/home" className="flow-back" aria-label="Back to home">
          <BackArrow />
        </Link>
        <h1 className="flow-topbar__title">Request Delivery</h1>
        <span className="flow-topbar__spacer" aria-hidden />
      </div>

      <div
        className={`flow-map${useDeliveryInteractiveMap || requestMapSrc ? ' flow-map--gmap' : ''}`}
        role="img"
        aria-label="Map with pickup and dropoff markers"
      >
        {useDeliveryInteractiveMap ? (
          <LiveUserGoogleMap
            mapCenter={deliveryInteractiveMapCenter}
            fallbackCenter={LONDON_CENTER}
            hasFix={live.hasFix}
            accurate={live.hasFix}
            accuracyM={live.accuracy}
            onLoadError={() => setDeliveryJsMapFailed(true)}
            zoomWithFix={15}
            zoomFallback={12}
            showUserLocationMarker={!hasPickupAndDropoff}
          />
        ) : (
          <>
            <GoogleMapEmbed src={requestMapSrc} title="Delivery route preview" />
            <LiveUserMapPuck
              headingDeg={live.headingDeg}
              accurate={live.hasFix}
              visible={
                !hasPickupAndDropoff && (live.hasFix || live.geoError !== 'denied')
              }
              className="live-puck--inMap"
            />
            <div className="flow-map__path" />
            <div className="flow-map__pin flow-map__pin--a">
              <MapPinA />
            </div>
            <div className="flow-map__pin flow-map__pin--b">
              <MapPinB />
            </div>
          </>
        )}
      </div>

      <LocationPermissionPrompt live={live} placement="flow" />

      <form className="flow-sheet" onSubmit={onContinue}>
        <div className="flow-sheet--scroll">
          <div className="flow-field flow-field--addrSuggest">
            <div className="flow-label">
              <span className="flow-dot flow-dot--g" />
              Pickup Location
            </div>
            <AddressSuggestInput
              id="flow-pickup"
              name="pickup"
              value={pickup}
              onChange={(v) => {
                setGpsNotice('');
                setPickup(v);
              }}
              placeholder="Enter pickup address"
              autoComplete="street-address"
              ariaLabel="Pickup address"
              inline
            />
            <button
              type="button"
              className="flow-geo"
              onClick={useGps}
              disabled={gpsLoading}
              aria-busy={gpsLoading}
            >
              <GpsIcon />
              {gpsLoading ? 'Finding address…' : 'Use my current location'}
            </button>
            {gpsNotice ? (
              <p className="flow-geo-notice" role="alert">
                {gpsNotice}
              </p>
            ) : null}
          </div>

          <div key={stops[0]?.id} className="flow-field flow-field--addrSuggest">
            <div className="flow-label">
              <span className="flow-dot flow-dot--r" />
              Drop-off Location
            </div>
            <AddressSuggestInput
              id="flow-dropoff"
              name="dropoff"
              value={stops[0]?.value ?? ''}
              onChange={(v) => setAt(0, v)}
              placeholder="Enter drop-off address"
              autoComplete="off"
              ariaLabel="Drop-off address"
              inline
            />
          </div>
        </div>
        <div
          style={{
            padding: '0.25rem 1.15rem 0.85rem',
            paddingBottom: 'max(0.85rem, env(safe-area-inset-bottom, 0))',
          }}
        >
          <button type="submit" className="flow-btn">
            Continue
          </button>
        </div>
      </form>
    </div>
  );
}
