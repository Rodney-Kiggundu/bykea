import React from 'react';

const placeholderBase = { width: '100%', maxWidth: 220, height: 180, margin: '0 auto' };

function IllustrationRider() {
  return (
    <svg
      viewBox="0 0 200 180"
      style={placeholderBase}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="20" y="120" width="160" height="4" rx="2" fill="#E5E5E5" />
      <circle cx="50" cy="150" r="16" fill="#1A1A1A" opacity="0.15" />
      <circle cx="150" cy="150" r="16" fill="#1A1A1A" opacity="0.15" />
      <path
        d="M55 100 L95 50 L120 50 L100 100 Z"
        fill="var(--ingo-primary)"
        opacity="0.2"
      />
      <rect x="85" y="35" width="40" height="20" rx="4" fill="var(--ingo-primary)" />
      <circle cx="100" cy="32" r="8" fill="#1A1A1A" />
      <path
        d="M95 100 L100 60 L65 100"
        stroke="var(--ingo-primary)"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IllustrationTaxi() {
  return (
    <svg
      viewBox="0 0 200 180"
      style={placeholderBase}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="25" y="95" width="150" height="45" rx="8" fill="var(--ingo-primary)" />
      <rect x="50" y="80" width="100" height="30" rx="4" fill="#1A1A1A" opacity="0.12" />
      <rect x="40" y="100" width="30" height="20" rx="2" fill="#E8E8E8" />
      <rect x="130" y="100" width="30" height="20" rx="2" fill="#E8E8E8" />
      <circle cx="60" cy="150" r="12" fill="#1A1A1A" opacity="0.25" />
      <circle cx="140" cy="150" r="12" fill="#1A1A1A" opacity="0.25" />
    </svg>
  );
}

function IllustrationShop() {
  return (
    <svg
      viewBox="0 0 200 180"
      style={placeholderBase}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="50" y="50" width="100" height="100" rx="4" fill="#1A1A1A" opacity="0.08" />
      <rect x="70" y="100" width="20" height="30" fill="var(--ingo-primary)" />
      <rect x="100" y="100" width="20" height="20" fill="#1A1A1A" opacity="0.15" />
      <rect x="130" y="100" width="10" height="20" fill="#1A1A1A" opacity="0.15" />
      <path d="M45 50 L100 20 L155 50 Z" fill="var(--ingo-primary)" opacity="0.35" />
    </svg>
  );
}

export { IllustrationRider, IllustrationTaxi, IllustrationShop };
