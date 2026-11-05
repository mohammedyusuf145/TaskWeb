import type { MessageKey } from '@/locales/en';

export interface SubjectPreset {
  key: string;
  nameKey: MessageKey;
  icon: string;
  color: string;
  /** Selected by default during onboarding. */
  core: boolean;
}

/** Bahrain public secondary track, editable at any time. */
export const SUBJECT_PRESETS: SubjectPreset[] = [
  { key: 'arabic', nameKey: 'subject.preset.arabic', icon: 'pen-line', color: '#C77806', core: true },
  { key: 'english', nameKey: 'subject.preset.english', icon: 'languages', color: '#046A94', core: true },
  { key: 'math', nameKey: 'subject.preset.math', icon: 'calculator', color: '#B83E0A', core: true },
  { key: 'physics', nameKey: 'subject.preset.physics', icon: 'atom', color: '#6F7DED', core: true },
  { key: 'chemistry', nameKey: 'subject.preset.chemistry', icon: 'flask-conical', color: '#029BA3', core: true },
  { key: 'biology', nameKey: 'subject.preset.biology', icon: 'dna', color: '#4C9D2D', core: true },
  { key: 'islamic', nameKey: 'subject.preset.islamic', icon: 'book-marked', color: '#027445', core: true },
  { key: 'citizenship', nameKey: 'subject.preset.citizenship', icon: 'landmark', color: '#8F6100', core: true },
  { key: 'design', nameKey: 'subject.preset.design', icon: 'palette', color: '#8E49B0', core: false },
];
