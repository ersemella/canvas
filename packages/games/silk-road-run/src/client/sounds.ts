/**
 * The fight's sounds, synthesized (the engine's `soundPlayer`), so they
 * need no files: placeholders until real ones are recorded. Each recorded
 * event the playback shows picks a cue (`eventCue`); the board system plays
 * it as the event comes up.
 */
import type {SoundSpec} from '@canvas/engine';
import type {AbilityId, FightState, Motion, RecordedEvent} from '../rules/types';

export type CueName =
  | 'swing'
  | 'heavy'
  | 'bow'
  | 'throw'
  | 'magic'
  | 'heal'
  | 'hail'
  | 'wind'
  | 'fire'
  | 'grab'
  | 'stomp'
  | 'boulder'
  | 'step'
  | 'whoosh'
  | 'hit'
  | 'mend'
  | 'death'
  | 'fallen'
  | 'skip'
  | 'won'
  | 'lost';

export const SOUNDS: Record<CueName, SoundSpec> = {
  // A blade through the air.
  swing: [
    {
      kind: 'noise',
      filter: 'bandpass',
      freq: 900,
      to: 3200,
      q: 2,
      duration: 0.14,
      volume: 0.5,
      attack: 0.03,
    },
  ],
  // A club, horns, a charge: lower and longer.
  heavy: [
    {
      kind: 'noise',
      filter: 'bandpass',
      freq: 400,
      to: 1400,
      q: 1.5,
      duration: 0.24,
      volume: 0.6,
      attack: 0.08,
    },
    {kind: 'tone', wave: 'triangle', freq: 140, to: 70, duration: 0.2, delay: 0.12, volume: 0.4},
  ],
  // A bowstring's twang.
  bow: [
    {kind: 'tone', wave: 'triangle', freq: 220, to: 180, duration: 0.18, volume: 0.45},
    {kind: 'noise', filter: 'highpass', freq: 3000, duration: 0.06, volume: 0.2},
  ],
  // Something thrown, spinning away.
  throw: [
    {
      kind: 'noise',
      filter: 'bandpass',
      freq: 1500,
      to: 600,
      q: 3,
      duration: 0.22,
      volume: 0.45,
      attack: 0.04,
    },
  ],
  // A rising shimmer.
  magic: [
    {kind: 'tone', wave: 'sine', freq: 660, to: 1320, duration: 0.35, volume: 0.3, attack: 0.05},
    {
      kind: 'tone',
      wave: 'sine',
      freq: 990,
      to: 1980,
      duration: 0.3,
      delay: 0.06,
      volume: 0.2,
      attack: 0.05,
    },
  ],
  // An elixir uncorked: a bright bubble.
  heal: [
    {kind: 'tone', wave: 'sine', freq: 520, to: 880, duration: 0.18, volume: 0.35},
    {kind: 'tone', wave: 'sine', freq: 780, to: 1240, duration: 0.18, delay: 0.09, volume: 0.25},
  ],
  // Ice clattering down.
  hail: [
    {kind: 'noise', filter: 'highpass', freq: 4000, duration: 0.05, volume: 0.35},
    {kind: 'noise', filter: 'highpass', freq: 3500, duration: 0.05, delay: 0.08, volume: 0.3},
    {kind: 'noise', filter: 'highpass', freq: 4500, duration: 0.05, delay: 0.15, volume: 0.3},
    {kind: 'noise', filter: 'highpass', freq: 3800, duration: 0.06, delay: 0.24, volume: 0.25},
  ],
  // A gust.
  wind: [
    {
      kind: 'noise',
      filter: 'lowpass',
      freq: 300,
      to: 1800,
      q: 0.7,
      duration: 0.5,
      volume: 0.5,
      attack: 0.15,
    },
  ],
  // Flames catching.
  fire: [
    {
      kind: 'noise',
      filter: 'lowpass',
      freq: 800,
      to: 2400,
      duration: 0.45,
      volume: 0.45,
      attack: 0.1,
    },
    {kind: 'noise', filter: 'highpass', freq: 5000, duration: 0.04, delay: 0.1, volume: 0.2},
    {kind: 'noise', filter: 'highpass', freq: 5000, duration: 0.04, delay: 0.25, volume: 0.2},
  ],
  // A grab, a shove: a short scuffle.
  grab: [
    {kind: 'noise', filter: 'lowpass', freq: 900, duration: 0.08, volume: 0.45},
    {kind: 'tone', wave: 'square', freq: 160, to: 110, duration: 0.08, delay: 0.02, volume: 0.15},
  ],
  // The ground thumped.
  stomp: [
    {kind: 'tone', wave: 'sine', freq: 110, to: 40, duration: 0.35, volume: 0.7},
    {kind: 'noise', filter: 'lowpass', freq: 500, to: 120, duration: 0.3, volume: 0.4},
  ],
  // A boulder heaved: a groan as it leaves.
  boulder: [
    {
      kind: 'noise',
      filter: 'lowpass',
      freq: 250,
      to: 600,
      duration: 0.35,
      volume: 0.5,
      attack: 0.12,
    },
  ],
  // A footstep or two in sand.
  step: [
    {kind: 'noise', filter: 'lowpass', freq: 700, duration: 0.05, volume: 0.18},
    {kind: 'noise', filter: 'lowpass', freq: 600, duration: 0.05, delay: 0.09, volume: 0.14},
  ],
  // A body thrown or leaping.
  whoosh: [
    {
      kind: 'noise',
      filter: 'bandpass',
      freq: 500,
      to: 2000,
      q: 1.5,
      duration: 0.28,
      volume: 0.45,
      attack: 0.1,
    },
  ],
  // A blow landing.
  hit: [
    {kind: 'tone', wave: 'square', freq: 180, to: 60, duration: 0.12, volume: 0.35},
    {kind: 'noise', filter: 'lowpass', freq: 1800, to: 300, duration: 0.12, volume: 0.5},
  ],
  // Health coming back: a short arpeggio.
  mend: [
    {kind: 'tone', wave: 'triangle', freq: 523, duration: 0.1, volume: 0.3},
    {kind: 'tone', wave: 'triangle', freq: 659, duration: 0.1, delay: 0.07, volume: 0.3},
    {kind: 'tone', wave: 'triangle', freq: 784, duration: 0.16, delay: 0.14, volume: 0.3},
  ],
  // An enemy falling.
  death: [
    {kind: 'tone', wave: 'square', freq: 330, to: 80, duration: 0.4, volume: 0.25},
    {
      kind: 'noise',
      filter: 'lowpass',
      freq: 600,
      to: 100,
      duration: 0.35,
      delay: 0.05,
      volume: 0.35,
    },
  ],
  // One of the caravan falling: slower, sadder.
  fallen: [
    {kind: 'tone', wave: 'triangle', freq: 392, to: 370, duration: 0.25, volume: 0.35},
    {kind: 'tone', wave: 'triangle', freq: 294, to: 196, duration: 0.5, delay: 0.22, volume: 0.35},
  ],
  // A turn passed by: a soft bloop.
  skip: [{kind: 'tone', wave: 'sine', freq: 300, to: 220, duration: 0.15, volume: 0.2}],
  // The fight won: a little fanfare.
  won: [
    {kind: 'tone', wave: 'square', freq: 523, duration: 0.12, volume: 0.2},
    {kind: 'tone', wave: 'square', freq: 659, duration: 0.12, delay: 0.12, volume: 0.2},
    {kind: 'tone', wave: 'square', freq: 784, duration: 0.12, delay: 0.24, volume: 0.2},
    {kind: 'tone', wave: 'square', freq: 1047, duration: 0.4, delay: 0.36, volume: 0.22},
  ],
  // The fight lost: falling notes.
  lost: [
    {kind: 'tone', wave: 'triangle', freq: 392, duration: 0.25, volume: 0.3},
    {kind: 'tone', wave: 'triangle', freq: 349, duration: 0.25, delay: 0.25, volume: 0.3},
    {kind: 'tone', wave: 'triangle', freq: 311, duration: 0.25, delay: 0.5, volume: 0.3},
    {kind: 'tone', wave: 'triangle', freq: 262, duration: 0.7, delay: 0.75, volume: 0.3},
  ],
};

/** The sound of using each ability; null for none (Hold). Every ability needs an entry. */
const ABILITY_CUES: Record<AbilityId, CueName | null> = {
  hold: null,
  snapShot: 'bow',
  skirmish: 'bow',
  longshot: 'bow',
  volley: 'bow',
  axeThrow: 'throw',
  hail: 'hail',
  sunlight: 'magic',
  omen: 'magic',
  blessing: 'magic',
  invocation: 'magic',
  alignment: 'magic',
  eclipse: 'magic',
  regrowSerpent: 'magic',
  elixir: 'heal',
  sedative: 'heal',
  grapple: 'grab',
  shove: 'grab',
  haul: 'grab',
  feed: 'grab',
  bite: 'swing',
  cleave: 'swing',
  swiftStrike: 'swing',
  reave: 'swing',
  lunge: 'swing',
  feignedRetreat: 'whoosh',
  leap: 'whoosh',
  charge: 'heavy',
  gore: 'heavy',
  smash: 'heavy',
  stomp: 'stomp',
  boulder: 'boulder',
  bananaFan: 'wind',
  gale: 'wind',
  fanFlames: 'fire',
  quench: 'wind',
};

/** Where an ability lands with a sound of its own (its damage plays as well). */
const LAND_CUES: Partial<Record<AbilityId, CueName>> = {
  boulder: 'stomp',
  stomp: 'stomp',
  hail: 'hail',
};

const MOTION_CUES: Record<Motion, CueName> = {
  walk: 'step',
  throw: 'whoosh',
  swap: 'whoosh',
  push: 'grab',
  pull: 'grab',
  leap: 'whoosh',
};

/** The sound an event makes as it shows, if any. `fight`: the board as of the event, for whose unit it is. */
export function eventCue(e: RecordedEvent, fight: FightState): CueName | null {
  switch (e.kind) {
    case 'turn':
      return null;
    case 'step':
      return MOTION_CUES[e.how];
    case 'action':
      return ABILITY_CUES[e.ability];
    case 'land':
      return LAND_CUES[e.ability] ?? null;
    case 'damage':
      return e.amount > 0 ? 'hit' : null;
    case 'heal':
      return e.amount > 0 ? 'mend' : null;
    case 'death':
      return fight.units.find((u) => u.id === e.unitId)?.side === 'player' ? 'fallen' : 'death';
    case 'skip':
      return 'skip';
  }
}

/** Which of several cues shown in one frame to play first: a death over a hit over the rest. */
export function cuePriority(cue: CueName): number {
  if (cue === 'death' || cue === 'fallen') return 3;
  if (cue === 'hit' || cue === 'mend') return 2;
  if (cue === 'step' || cue === 'skip') return 0;
  return 1;
}
