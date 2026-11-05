/**
 * Interface sounds, synthesised with Web Audio (no files, works offline).
 * Short, soft and tonal; one shared context, created on first use after a gesture.
 */
import { usePrefs } from './prefs';

export type UiSound = 'complete' | 'create' | 'tap' | 'toggle' | 'error' | 'send' | 'receive';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** One bell-like partial: sine with a fast attack and an exponential tail. */
function tone(ac: AudioContext, out: AudioNode, freq: number, at: number, dur: number, gain: number, type: OscillatorType = 'sine') {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + dur + 0.02);
}

const VIBRATE: Partial<Record<UiSound, number | number[]>> = { complete: [12, 40, 18], create: 10, error: [30, 40, 30], toggle: 8 };

export function playUi(kind: UiSound) {
  const p = usePrefs.getState();
  if (p.haptics && VIBRATE[kind] && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(VIBRATE[kind]!);
    } catch {
      /* not allowed */
    }
  }
  if (!p.sounds || p.soundVolume <= 0) return;
  const ac = audio();
  if (!ac) return;
  const out = ac.createGain();
  out.gain.value = 0.22 * p.soundVolume;
  out.connect(ac.destination);
  const t = ac.currentTime + 0.01;
  switch (kind) {
    case 'complete': // rising fifth, like a pearl dropping into a bowl
      tone(ac, out, 659.25, t, 0.35, 0.6);
      tone(ac, out, 987.77, t + 0.07, 0.6, 0.5);
      tone(ac, out, 1975.5, t + 0.07, 0.25, 0.08);
      break;
    case 'create':
      tone(ac, out, 783.99, t, 0.22, 0.45);
      tone(ac, out, 1174.66, t + 0.04, 0.28, 0.3);
      break;
    case 'send':
      tone(ac, out, 880, t, 0.12, 0.3);
      tone(ac, out, 1318.5, t + 0.05, 0.16, 0.22);
      break;
    case 'receive':
      tone(ac, out, 1046.5, t, 0.2, 0.25);
      tone(ac, out, 783.99, t + 0.06, 0.3, 0.22);
      break;
    case 'tap':
      tone(ac, out, 1760, t, 0.05, 0.18, 'triangle');
      break;
    case 'toggle':
      tone(ac, out, 1318.5, t, 0.08, 0.22, 'triangle');
      break;
    case 'error':
      tone(ac, out, 311.13, t, 0.18, 0.4, 'triangle');
      tone(ac, out, 233.08, t + 0.12, 0.26, 0.35, 'triangle');
      break;
  }
}
