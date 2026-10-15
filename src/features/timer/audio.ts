/**
 * Ambient sound and the end-of-session chime, generated with the Web Audio API:
 * no audio files to license or download, and it all works offline.
 * "Your track" plays a file the user picks from their device (stored locally).
 */
import { create } from 'zustand';
import { getDb } from '@/lib/db';

export type Ambient = 'none' | 'rain' | 'cafe' | 'white' | 'brown' | 'track';

const PREF_KEY = 'mizan.sound';
export const TRACK_ID = 'ambient-track';

interface SoundPrefs {
  ambient: Ambient;
  volume: number; // 0..1
  playing: boolean;
  trackName: string | null;
}

function readPrefs(): Omit<SoundPrefs, 'playing'> {
  try {
    const v = JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}');
    return { ambient: v.ambient ?? 'none', volume: typeof v.volume === 'number' ? v.volume : 0.5, trackName: v.trackName ?? null };
  } catch {
    return { ambient: 'none', volume: 0.5, trackName: null };
  }
}

export const useSound = create<SoundPrefs>(() => ({ ...readPrefs(), playing: false }));

function save() {
  const { ambient, volume, trackName } = useSound.getState();
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify({ ambient, volume, trackName }));
  } catch {
    /* ignore */
  }
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let current: { stop: () => void } | null = null;

function audio(): { ctx: AudioContext; master: GainNode } {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = useSound.getState().volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, master: master! };
}

function noiseBuffer(c: AudioContext, kind: 'white' | 'brown' | 'pink', seconds = 4): AudioBuffer {
  const buf = c.createBuffer(2, c.sampleRate * seconds, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w * 0.35;
      else if (kind === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.2;
      } else {
        // Paul Kellet's pink noise filter.
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.09;
        b6 = w * 0.115926;
      }
    }
  }
  return buf;
}

function loop(c: AudioContext, buf: AudioBuffer): AudioBufferSourceNode {
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

/** Fade a graph in, and return a stopper that fades it out. */
function withFade(c: AudioContext, out: GainNode, build: (g: GainNode) => { nodes: AudioScheduledSourceNode[]; timers?: number[] }) {
  const g = c.createGain();
  g.gain.value = 0;
  g.connect(out);
  const { nodes, timers = [] } = build(g);
  nodes.forEach((n) => n.start());
  g.gain.linearRampToValueAtTime(1, c.currentTime + 1.2);
  return {
    stop: () => {
      timers.forEach((t) => clearInterval(t));
      g.gain.cancelScheduledValues(c.currentTime);
      g.gain.setValueAtTime(g.gain.value, c.currentTime);
      g.gain.linearRampToValueAtTime(0, c.currentTime + 0.6);
      setTimeout(() => {
        nodes.forEach((n) => n.stop());
        g.disconnect();
      }, 700);
    },
  };
}

function rain(c: AudioContext, out: GainNode) {
  return withFade(c, out, (g) => {
    const src = loop(c, noiseBuffer(c, 'pink', 6));
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 400;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7000;
    // Slow swell, like gusts.
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 0.18;
    const level = c.createGain();
    level.gain.value = 0.8;
    lfo.connect(lfoGain).connect(level.gain);
    src.connect(hp).connect(lp).connect(level).connect(g);
    // Occasional close drops.
    const drops = window.setInterval(() => {
      const t = c.currentTime + Math.random() * 0.3;
      const o = c.createBufferSource();
      o.buffer = noiseBuffer(c, 'white', 0.05);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2500 + Math.random() * 3000;
      bp.Q.value = 6;
      const e = c.createGain();
      e.gain.setValueAtTime(0.0001, t);
      e.gain.exponentialRampToValueAtTime(0.25, t + 0.005);
      e.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o.connect(bp).connect(e).connect(g);
      o.start(t);
      o.stop(t + 0.06);
    }, 140);
    return { nodes: [src, lfo], timers: [drops] };
  });
}

function cafe(c: AudioContext, out: GainNode) {
  return withFade(c, out, (g) => {
    const room = loop(c, noiseBuffer(c, 'brown', 6));
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const roomGain = c.createGain();
    roomGain.gain.value = 0.7;
    room.connect(lp).connect(roomGain).connect(g);
    // Murmur: band-limited noise with slow, uneven movement.
    const voices = loop(c, noiseBuffer(c, 'pink', 6));
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 600;
    bp.Q.value = 0.9;
    const vg = c.createGain();
    vg.gain.value = 0.35;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.23;
    const lg = c.createGain();
    lg.gain.value = 0.15;
    lfo.connect(lg).connect(vg.gain);
    voices.connect(bp).connect(vg).connect(g);
    // Now and then, a cup on a saucer.
    const clinks = window.setInterval(() => {
      if (Math.random() > 0.35) return;
      const t = c.currentTime + Math.random();
      for (const f of [2093, 3136]) {
        const o = c.createOscillator();
        o.frequency.value = f * (0.98 + Math.random() * 0.04);
        const e = c.createGain();
        e.gain.setValueAtTime(0.0001, t);
        e.gain.exponentialRampToValueAtTime(0.03, t + 0.004);
        e.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        o.connect(e).connect(g);
        o.start(t);
        o.stop(t + 0.4);
      }
    }, 2500);
    return { nodes: [room, voices, lfo], timers: [clinks] };
  });
}

function plainNoise(c: AudioContext, out: GainNode, kind: 'white' | 'brown') {
  return withFade(c, out, (g) => {
    const src = loop(c, noiseBuffer(c, kind, 4));
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = kind === 'white' ? 9000 : 1200;
    src.connect(lp).connect(g);
    return { nodes: [src] };
  });
}

async function track(c: AudioContext, out: GainNode) {
  const file = await getDb().files.get(TRACK_ID);
  if (!file) return null;
  const el = new Audio(URL.createObjectURL(file.blob));
  el.loop = true;
  const node = c.createMediaElementSource(el);
  const g = c.createGain();
  g.gain.value = 0;
  node.connect(g).connect(out);
  await el.play();
  g.gain.linearRampToValueAtTime(1, c.currentTime + 1.2);
  return {
    stop: () => {
      g.gain.linearRampToValueAtTime(0, c.currentTime + 0.6);
      setTimeout(() => {
        el.pause();
        URL.revokeObjectURL(el.src);
        g.disconnect();
      }, 700);
    },
  };
}

export const sound = {
  /** Must be called from a user gesture the first time (browser autoplay rules). */
  async play(kind?: Ambient) {
    const ambient = kind ?? useSound.getState().ambient;
    current?.stop();
    current = null;
    if (ambient === 'none') return useSound.setState({ playing: false });
    const { ctx: c, master: m } = audio();
    current =
      ambient === 'rain' ? rain(c, m) : ambient === 'cafe' ? cafe(c, m) : ambient === 'track' ? await track(c, m) : plainNoise(c, m, ambient);
    useSound.setState({ playing: Boolean(current) });
  },
  stop() {
    current?.stop();
    current = null;
    useSound.setState({ playing: false });
  },
  setAmbient(ambient: Ambient) {
    useSound.setState({ ambient });
    save();
    if (useSound.getState().playing || ambient !== 'none') void sound.play(ambient);
  },
  setVolume(volume: number) {
    useSound.setState({ volume });
    if (master && ctx) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
    save();
  },
  async setTrack(file: File) {
    await getDb().files.put({ id: TRACK_ID, blob: file, uploaded: 1 });
    useSound.setState({ trackName: file.name });
    save();
    sound.setAmbient('track');
  },
  /** A soft two-note chime (a fifth apart), with a slow release. */
  chime(volume = 0.6) {
    const { ctx: c } = audio();
    const out = c.createGain();
    out.gain.value = volume * 0.35;
    out.connect(c.destination);
    const t0 = c.currentTime + 0.02;
    [
      [659.25, 0],
      [987.77, 0.18],
    ].forEach(([f, delay]) => {
      for (const [mult, amp] of [
        [1, 1],
        [2, 0.18],
        [3, 0.06],
      ] as const) {
        const o = c.createOscillator();
        o.type = 'sine';
        o.frequency.value = f! * mult;
        const e = c.createGain();
        const t = t0 + delay!;
        e.gain.setValueAtTime(0.0001, t);
        e.gain.exponentialRampToValueAtTime(amp, t + 0.015);
        e.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
        o.connect(e).connect(out);
        o.start(t);
        o.stop(t + 2.5);
      }
    });
  },
};
