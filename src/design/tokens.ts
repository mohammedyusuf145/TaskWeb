/** Tokens needed in TypeScript (motion, subject palette). Visual tokens live in tokens.css. */

export const motion = {
  fast: 0.12,
  base: 0.18,
  slow: 0.24,
  sheet: 0.3,
  ease: [0.2, 0, 0, 1] as const,
  exit: [0.4, 0, 1, 1] as const,
  emphasized: [0.05, 0.7, 0.1, 1] as const,
};

/**
 * Ten subject colours, in a fixed categorical order validated for charts in both themes
 * (lightness band, chroma floor, colour-blind separation of neighbours, contrast vs surface).
 * New subjects take the next unused slot, so neighbouring subjects stay distinguishable.
 * Charts use the hex as-is; UI text and dots go through subjectColor().
 */
export const SUBJECT_COLORS = [
  { id: 'pink', hex: '#CE5593' },
  { id: 'forest', hex: '#027445' },
  { id: 'saffron', hex: '#C77806' },
  { id: 'ocean', hex: '#046A94' },
  { id: 'leaf', hex: '#4C9D2D' },
  { id: 'bronze', hex: '#8F6100' },
  { id: 'iris', hex: '#6F7DED' },
  { id: 'rust', hex: '#B83E0A' },
  { id: 'teal', hex: '#029BA3' },
  { id: 'plum', hex: '#8E49B0' },
] as const;

export type SubjectColorId = (typeof SUBJECT_COLORS)[number]['id'];

/** Subject colour for UI text, dots and chips: lifted in dark mode, deepened in light mode (AA as text). */
export function subjectColor(hex: string): string {
  return `color-mix(in oklab, ${hex} var(--subject-mix), var(--subject-toward))`;
}

/** Subject colour for chart marks: the validated palette value itself. */
export function chartColor(hex: string): string {
  return hex;
}
