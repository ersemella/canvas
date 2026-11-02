/**
 * Synthesized sound effects: a sound is a few layers of tone or noise,
 * shaped by a volume envelope and an optional pitch glide, built on the
 * Web Audio API each time it plays, so a game needs no audio files.
 *
 * Browsers start audio suspended until the player clicks or presses a key,
 * so the page calls `unlockOnGesture()` once; before that (and wherever
 * there's no Web Audio, as in tests) `play` does nothing.
 */

/** An oscillator's note, gliding from `freq` to `to` (Hz) over its duration. */
export interface ToneLayer {
  kind: 'tone';
  wave?: OscillatorType;
  freq: number;
  to?: number;
  /** Seconds, attack included. */
  duration: number;
  /** Seconds after the sound starts. */
  delay?: number;
  /** 0 to 1; default 0.5. */
  volume?: number;
  /** Seconds to reach full volume; default 0.005. */
  attack?: number;
}

/** White noise through a filter whose cutoff glides from `freq` to `to` (Hz). */
export interface NoiseLayer {
  kind: 'noise';
  filter?: BiquadFilterType;
  freq?: number;
  to?: number;
  q?: number;
  duration: number;
  delay?: number;
  volume?: number;
  attack?: number;
}

export type SoundLayer = ToneLayer | NoiseLayer;
export type SoundSpec = readonly SoundLayer[];

export interface PlayOptions {
  /** Multiplies every layer's volume. */
  volume?: number;
  /** Multiplies every frequency: 1.06 is about a semitone up. */
  pitch?: number;
}

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export class SoundPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private isMuted = false;
  private listeners = new Set<(muted: boolean) => void>();

  /** Overall volume, 0 to 1. */
  volume = 0.35;

  get muted(): boolean {
    return this.isMuted;
  }

  set muted(value: boolean) {
    if (value === this.isMuted) return;
    this.isMuted = value;
    this.listeners.forEach((fn) => fn(value));
  }

  /** Called whenever `muted` changes; returns the unsubscribe. */
  onMutedChange(fn: (muted: boolean) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** True once audio can play (a gesture has unlocked it). */
  get ready(): boolean {
    return this.ctx?.state === 'running';
  }

  /** Creates or resumes the audio context; call from inside a click or key handler. */
  unlock(): void {
    const Ctor = audioContextCtor();
    if (!Ctor) return;
    if (!this.ctx) {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
  }

  /** Unlocks on the page's next pointer or key press; returns a cleanup. */
  unlockOnGesture(): () => void {
    if (typeof window === 'undefined') return () => undefined;
    const events = ['pointerdown', 'keydown', 'touchend'] as const;
    const handler = () => {
      this.unlock();
      if (this.ready || !audioContextCtor()) remove();
    };
    const remove = () => events.forEach((e) => window.removeEventListener(e, handler, true));
    events.forEach((e) => window.addEventListener(e, handler, true));
    return remove;
  }

  play(spec: SoundSpec, {volume = 1, pitch = 1}: PlayOptions = {}): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.isMuted || ctx.state !== 'running') return;
    this.master.gain.value = this.volume;
    const now = ctx.currentTime;
    for (const layer of spec) {
      const start = now + (layer.delay ?? 0);
      const end = start + layer.duration;
      const peak = Math.max(0.0001, (layer.volume ?? 0.5) * volume);
      const attack = Math.min(layer.attack ?? 0.005, layer.duration / 2);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      gain.connect(this.master);

      let source: AudioScheduledSourceNode;
      if (layer.kind === 'tone') {
        const osc = ctx.createOscillator();
        osc.type = layer.wave ?? 'square';
        osc.frequency.setValueAtTime(layer.freq * pitch, start);
        if (layer.to !== undefined)
          osc.frequency.exponentialRampToValueAtTime(Math.max(1, layer.to * pitch), end);
        osc.connect(gain);
        source = osc;
      } else {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer(ctx);
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = layer.filter ?? 'lowpass';
        filter.frequency.setValueAtTime((layer.freq ?? 2000) * pitch, start);
        if (layer.to !== undefined)
          filter.frequency.exponentialRampToValueAtTime(Math.max(1, layer.to * pitch), end);
        filter.Q.value = layer.q ?? 1;
        src.connect(filter).connect(gain);
        source = src;
      }
      source.start(start);
      source.stop(end + 0.02);
      source.onended = () => gain.disconnect();
    }
  }

  /** One second of white noise, made once and looped. */
  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noise;
  }
}

/** The page's one player: every game plays through it, so one mute covers them all. */
export const soundPlayer = new SoundPlayer();
