import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import GoogleMapEmbed from '../components/GoogleMapEmbed';
import {
  getGoogleMapsApiKey,
  mapsKeyedPlaceEmbedUrl,
  mapsLegacyPlaceEmbedUrl,
  publicDirectionsMapUrl,
  publicViewMapUrl,
} from '../lib/googleMapsConfig';
import './mapsDebug.css';

const SAMPLE_PLACE = 'London, Shoreditch';

export default function MapsDebugPage() {
  const keyLine = useMemo(() => {
    const k = getGoogleMapsApiKey();
    if (!k) return 'Not set (empty). Add REACT_APP_GOOGLE_MAPS_API_KEY to .env and restart npm start.';
    return `Set (${k.length} chars): ${k.slice(0, 7)}…${k.slice(-4)}`;
  }, []);

  const embedApiOnlySrc = useMemo(() => mapsKeyedPlaceEmbedUrl(SAMPLE_PLACE), []);
  const legacyPlaceSrc = useMemo(() => mapsLegacyPlaceEmbedUrl(SAMPLE_PLACE), []);
  const viewSrc = useMemo(() => publicViewMapUrl(51.5074, -0.1278, 12), []);
  const dirSrc = useMemo(
    () => publicDirectionsMapUrl('Stratford, London E15', 'Oxford Street, London W1'),
    [],
  );

  return (
    <div className="maps-debug" role="main">
      <header className="maps-debug__head">
        <Link to="/home" className="maps-debug__back">
          ← Back to app home
        </Link>
        <h1>Maps debug (/maps)</h1>
      </header>

      <div className="maps-debug__panel" aria-live="polite">
        <p style={{ margin: '0 0 0.5rem', color: '#cfcfcf' }}>
          <strong style={{ color: '#fff' }}>If the top map is grey/blank but the bottom map works:</strong>
          your key is fine, but the <strong>Maps Embed API</strong> is not allowed for this app yet. In
          {' '}
          <a href="https://console.cloud.google.com/google/maps-apis/api-list" target="_blank" rel="noopener noreferrer" style={{ color: '#8ec5ff' }}>Google Cloud → APIs</a>
          : (1) enable <strong>Maps Embed API</strong> for the same project as the key, (2) enable <strong>billing</strong> on that project if Google requires it, (3) under Credentials → your API key → <strong>Application restrictions</strong> choose <em>HTTP referrers</em> and add
          {' '}
          <code style={{ color: '#b8e986' }}>http://localhost:3000/*</code>
          {' '}
          (and your live site). Wait a minute, then hard-refresh. In the browser, open DevTools → <strong>Network</strong>, click the iframe request, and read the error text if any.
        </p>
        <p style={{ margin: '0 0 0.35rem' }}>
          <strong>API key:</strong> {keyLine}
        </p>
        <p style={{ margin: '0 0 0.25rem' }}>
          <strong>Embed API URL only (place):</strong>
        </p>
        <code>{embedApiOnlySrc || '(no key — empty)'}</code>
        <p style={{ margin: '0.55rem 0 0.2rem' }}>
          <strong>Legacy URL (no key):</strong>
        </p>
        <code>{legacyPlaceSrc || '(none)'}</code>
        <p style={{ margin: '0.55rem 0 0.2rem' }}>
          <strong>Alt — view (center):</strong>
        </p>
        <code>{viewSrc || '(none)'}</code>
        <p style={{ margin: '0.55rem 0 0.2rem' }}>
          <strong>Alt — directions:</strong>
        </p>
        <code>{dirSrc || '(none)'}</code>
      </div>

      <div className="maps-debug__maps">
        <section className="maps-debug__mapBlock" aria-label="Maps Embed API">
          <h2 className="maps-debug__mapLabel">A — Maps Embed API (needs enable + billing + referrer)</h2>
          <div className="maps-debug__mapWrap maps-debug__mapWrap--half">
            <GoogleMapEmbed src={embedApiOnlySrc} title="Embed API place" loading="eager" />
            {!embedApiOnlySrc ? <p className="maps-debug__empty">No keyed embed URL</p> : null}
          </div>
        </section>
        <section className="maps-debug__mapBlock" aria-label="Legacy embed">
          <h2 className="maps-debug__mapLabel">B — Legacy embed (no Maps Embed API required)</h2>
          <div className="maps-debug__mapWrap maps-debug__mapWrap--half">
            <GoogleMapEmbed src={legacyPlaceSrc} title="Legacy place map" loading="eager" />
            {!legacyPlaceSrc ? <p className="maps-debug__empty">No legacy URL</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
