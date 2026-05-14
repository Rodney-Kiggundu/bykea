import './GoogleMapEmbed.css';

/**
 * Renders a Maps Embed API iframe when `src` is non-empty; otherwise renders nothing.
 * Enable **Maps Embed API** for your Google Cloud key.
 */
export default function GoogleMapEmbed({ src, title = 'Map', loading = 'lazy', lockInteractions = false }) {
  if (!src) return null;
  return (
    <div className={lockInteractions ? 'gmap-embed-wrap gmap-embed-wrap--locked' : 'gmap-embed-wrap'}>
      <iframe
        key={src}
        className="gmap-embed-frame"
        title={title}
        src={src}
        loading={loading}
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
