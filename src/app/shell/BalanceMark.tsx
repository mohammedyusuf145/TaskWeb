import { useId } from 'react';
import { motion } from 'motion/react';
import { useReducedMotion } from '@/lib/prefs';

/**
 * The welcome moment: a pearl drops onto the beam, the beam tips, then settles level.
 * Mizan means balance, and this is the only orchestrated animation on first load.
 */
export function BalanceMark({ size = 220 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  const reduced = useReducedMotion();
  const ease = [0.22, 1, 0.36, 1] as const;
  return (
    <svg width={size} height={size} viewBox="0 0 220 220" fill="none" aria-hidden>
      <defs>
        <radialGradient id={`pearl${id}`} cx="0.36" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="0.36" stopColor="#f3dfb6" />
          <stop offset="0.7" stopColor="#b8d6ea" />
          <stop offset="1" stopColor="#c4b2ea" />
        </radialGradient>
        <radialGradient id={`glow${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <motion.circle
        cx="110"
        cy="96"
        r="96"
        fill={`url(#glow${id})`}
        initial={reduced ? false : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.9, duration: 1.4, ease }}
        style={{ transformOrigin: '110px 96px' }}
      />
      {/* Fulcrum */}
      <motion.path
        d="M110 142 94 174h32L110 142Z"
        fill="var(--text)"
        fillOpacity="0.9"
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
      />
      {/* Beam: tips under the pearl's weight, then finds level */}
      <motion.g
        style={{ transformOrigin: '110px 140px' }}
        initial={reduced ? false : { rotate: -9, opacity: 0 }}
        animate={reduced ? { rotate: 0, opacity: 1 } : { rotate: [-9, -9, 6, -2.5, 1, 0], opacity: [0, 1, 1, 1, 1, 1] }}
        transition={{ duration: 1.9, times: [0, 0.18, 0.42, 0.62, 0.8, 1], ease: 'easeInOut' }}
      >
        <rect x="34" y="134" width="152" height="12" rx="6" fill="var(--accent)" />
        <motion.circle
          cx="110"
          cy="100"
          r="32"
          fill={`url(#pearl${id})`}
          initial={reduced ? false : { y: -120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25, type: 'spring', stiffness: 220, damping: 15, mass: 0.9 }}
        />
      </motion.g>
    </svg>
  );
}
