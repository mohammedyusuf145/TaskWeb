import { useId } from 'react';

/**
 * Mizan mark: a pearl balanced on a beam. The pearl is the one place the nacre
 * gradient lives; everything else in the UI stays flat.
 */
export function LogoMark({ size = 24, framed = true }: { size?: number; framed?: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <radialGradient id={`p${id}`} cx="0.36" cy="0.32" r="0.78">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="0.38" stopColor="#f3dfb6" />
          <stop offset="0.72" stopColor="#b8d6ea" />
          <stop offset="1" stopColor="#c4b2ea" />
        </radialGradient>
      </defs>
      {framed && <rect x="0.5" y="0.5" width="23" height="23" rx="7" fill="#0e182b" stroke="rgb(170 195 255 / 0.18)" />}
      <circle cx="12" cy="9.25" r="4.25" fill={`url(#p${id})`} />
      <path d="M4.75 15h14.5" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M12 15.6 9.6 19.25h4.8L12 15.6Z" fill="#eef2fa" fillOpacity="0.85" />
    </svg>
  );
}
