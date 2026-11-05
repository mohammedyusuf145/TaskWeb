import {
  Atom,
  BookMarked,
  BookOpen,
  Brain,
  Calculator,
  Code,
  Dna,
  FlaskConical,
  Globe,
  Landmark,
  Languages,
  Leaf,
  Microscope,
  Music,
  Palette,
  PenLine,
  Scale,
  Sigma,
  type LucideIcon,
} from 'lucide-react';

export const SUBJECT_ICONS: Record<string, LucideIcon> = {
  'pen-line': PenLine,
  languages: Languages,
  calculator: Calculator,
  sigma: Sigma,
  atom: Atom,
  'flask-conical': FlaskConical,
  dna: Dna,
  microscope: Microscope,
  'book-marked': BookMarked,
  landmark: Landmark,
  scale: Scale,
  globe: Globe,
  leaf: Leaf,
  brain: Brain,
  palette: Palette,
  code: Code,
  music: Music,
  'book-open': BookOpen,
};

export function SubjectIcon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const Icon = SUBJECT_ICONS[name] ?? BookOpen;
  return <Icon size={size} className={className} aria-hidden />;
}
