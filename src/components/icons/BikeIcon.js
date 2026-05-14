/**
 * Side-view bicycle (outline), tuned for small ride-type tiles.
 * @param {{ size?: number, className?: string }} props
 */
export default function BikeIcon({ size = 24, className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="6.5" cy="16.5" r="3.4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17.5" cy="16.5" r="3.4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6.5 16.5h4.5l2-7.5h2.5l2 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15.5 9V6.5M13.5 6.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
