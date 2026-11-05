import { useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';

/** Where leaves sit along the stem (0..1 of growth), and which side they face. */
const LEAVES: { t: number; x: number; y: number; side: 1 | -1; size: number }[] = [
  { t: 0.16, x: 119.5, y: 203, side: 1, size: 1.0 },
  { t: 0.3, x: 122.5, y: 178, side: -1, size: 1.05 },
  { t: 0.44, x: 124, y: 152, side: 1, size: 0.95 },
  { t: 0.58, x: 121.5, y: 126, side: -1, size: 0.9 },
  { t: 0.71, x: 118.5, y: 101, side: 1, size: 0.8 },
  { t: 0.83, x: 118.5, y: 78, side: -1, size: 0.7 },
];
const STEM = 'M120 232 C 117 196, 128 160, 122 124 S 112 72, 121 48';
const TIP = { x: 121, y: 48 };

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/**
 * The Focus Garden: a plant that grows with the focus session, flowers when it completes,
 * rests during breaks, and leans slightly if you leave mid-session (recovering as you continue).
 */
export function Garden({
  growth,
  phase,
  running,
  wilt,
  flowerColor,
  size = 280,
}: {
  growth: number;
  phase: 'idle' | 'focus' | 'break';
  running: boolean;
  wilt: number;
  flowerColor: string;
  size?: number;
}) {
  const t = useT();
  const g = phase === 'break' ? 1 : phase === 'idle' ? 0.035 : clamp(growth);
  const bloom = phase === 'break' ? 1 : clamp((g - 0.94) / 0.06);
  const bud = clamp((g - 0.86) / 0.08);
  const leaf = 'color-mix(in oklab, var(--accent) 88%, var(--text) 12%)';
  const leafDeep = 'color-mix(in oklab, var(--accent) 70%, var(--bg) 30%)';

  return (
    <svg
      viewBox="0 0 240 280"
      width={size}
      height={(size * 280) / 240}
      role="img"
      aria-label={t('focus.garden.label', { pct: Math.round(g * 100) })}
      className="max-w-full"
    >
      {/* Ground shadow */}
      <ellipse cx="120" cy="272" rx="58" ry="5" fill="var(--text)" opacity="0.05" />

      <g className="garden-wilt" style={{ transform: `rotate(${wilt * 16}deg)`, filter: `saturate(${1 - wilt * 0.9})` }}>
        <g className={cn('garden-sway', phase === 'break' && 'garden-rest', !running && 'garden-still')}>
          {/* Stem */}
          <path
            d={STEM}
            pathLength={1}
            fill="none"
            stroke={leafDeep}
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeDasharray="1"
            strokeDashoffset={1 - Math.max(g, 0.06)}
            className="garden-stem"
          />
          {/* Leaves */}
          {LEAVES.map((l, i) => {
            const k = clamp((g - l.t) / 0.07);
            const droop = wilt * 26;
            return (
              <g key={i} transform={`translate(${l.x} ${l.y}) scale(${l.side} 1)`}>
                <g
                  className="garden-leaf"
                  style={{ transform: `rotate(${-24 + droop}deg) scale(${k * l.size})`, transformOrigin: '0px 0px', opacity: k ? 1 : 0 }}
                >
                  <path d="M0 0 C 9 -13, 30 -14, 42 -3 C 30 6, 11 8, 0 0 Z" fill={leaf} />
                  <path d="M2 -0.5 C 14 -4, 26 -5, 38 -3" fill="none" stroke={leafDeep} strokeWidth="0.9" strokeLinecap="round" opacity="0.7" />
                </g>
              </g>
            );
          })}
          {/* Bud → flower */}
          <g transform={`translate(${TIP.x} ${TIP.y})`}>
            <g className="garden-leaf" style={{ transform: `scale(${bud})`, opacity: bud ? 1 : 0 }}>
              {Array.from({ length: 7 }, (_, i) => {
                const a = (i * 360) / 7;
                const open = 0.35 + bloom * 0.65;
                return (
                  <ellipse
                    key={i}
                    cx="0"
                    cy={-8 * open}
                    rx={5.2 * (0.6 + bloom * 0.4)}
                    ry={9 * open + 3}
                    fill={flowerColor}
                    opacity={0.78 + bloom * 0.22}
                    transform={`rotate(${a + bloom * 8})`}
                  />
                );
              })}
              <circle r={4.2 + bloom * 1.6} fill="color-mix(in oklab, #E3B04F 85%, var(--text) 15%)" />
            </g>
          </g>
        </g>
      </g>

      {/* Pot */}
      <path d="M86 238 h68 l-7 32 a4 4 0 0 1 -4 3 h-46 a4 4 0 0 1 -4 -3 z" fill="var(--surface-3)" stroke="var(--border-strong)" />
      <rect x="80" y="228" width="80" height="12" rx="3" fill="var(--surface-3)" stroke="var(--border-strong)" />
      <ellipse cx="120" cy="231" rx="34" ry="2.6" fill="color-mix(in oklab, var(--text) 18%, var(--surface-3))" />
    </svg>
  );
}

/** Small flower for each focus session completed today. */
export function Sprout({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 28" width={size} height={(size * 28) / 24} aria-hidden>
      <path d="M12 26 C 11 20, 13 15, 12 10" stroke="color-mix(in oklab, var(--accent) 70%, var(--bg) 30%)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M12 19 C 15 16, 19 16, 21 18 C 18 20, 15 20, 12 19 Z" fill="var(--accent)" />
      {Array.from({ length: 5 }, (_, i) => (
        <ellipse key={i} cx="12" cy="5.4" rx="2.4" ry="3.6" fill={color} transform={`rotate(${i * 72} 12 9)`} />
      ))}
      <circle cx="12" cy="9" r="2" fill="#E3B04F" />
    </svg>
  );
}
