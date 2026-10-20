/**
 * Playing back what a turn set off (the player's turn and the AI turns
 * after it), one event at a time, so the board doesn't jump from before to
 * after. The rules record the events with a snapshot of the board after
 * each (`FightState.events`); this keeps the time and builds the fight to
 * draw at each step. The board system draws it and each event's flourish.
 */
import {hexDistance} from '@canvas/engine/server';
import type {FightState, RecordedEvent} from '../rules/types';

/** What the page sends the board (`tactics:playback`): the fight before the turn and after it. */
export interface PlaybackPayload {
  from: FightState;
  to: FightState;
}

/** Seconds a unit takes to walk one hex. */
const WALK_SECONDS = 0.16;

/** How long an event shows, in seconds; 0 skips it. */
export function eventSeconds(e: RecordedEvent, last: boolean): number {
  switch (e.kind) {
    case 'turn':
      // The last event is the player's own turn coming up: nothing to watch.
      return last ? 0 : 0.4;
    case 'step':
      if (e.how === 'walk') return WALK_SECONDS;
      if (e.how === 'push') return 0.14;
      if (e.how === 'throw') return 0.32;
      return Math.max(0.18, 0.08 * hexDistance(e.from, e.to));
    case 'action':
      return e.ability === 'hold' ? 0 : 0.5;
    case 'charge':
      return 0.6;
    case 'damage':
      return 0.45;
    case 'heal':
      return 0.4;
    case 'death':
      return 0.5;
  }
}

/**
 * The fight to draw once an event has happened: the fight before the turn,
 * with each unit's position, health, card and charge, the hail, the fog and
 * the slot from the event's snapshot. The unit whose turn it is shows as
 * acting. Statuses stay as they were until the playback ends, except
 * that each goes once the slot passes its last one.
 */
export function displayFight(base: FightState, e: RecordedEvent, actor: string | null): FightState {
  const after = e.after;
  return {
    ...base,
    phase: 'fight',
    currentSlot: after.currentSlot,
    effects: after.effects,
    fog: after.fog,
    awaiting: actor,
    units: base.units.map((u) => {
      const s = after.units.find((v) => v.id === u.id);
      // Statuses that ended before the slot shown go, as the rules expire them.
      const statuses = u.statuses.filter((st) => st.untilSlot >= after.currentSlot);
      return {...u, ...s, statuses};
    }),
  };
}

export class Playback {
  readonly events: RecordedEvent[];
  /** The event showing now. */
  index = 0;
  /** Seconds into it. */
  elapsed = 0;
  /** The board as of the event showing now. */
  display: FightState;
  private readonly base: FightState;
  /** The unit whose turn it is, as of the event showing now. */
  private actor: string | null = null;

  constructor({from, to}: PlaybackPayload) {
    this.base = from;
    this.events = to.events ?? [];
    this.display = from;
    this.show(0);
  }

  get current(): RecordedEvent | undefined {
    return this.events[this.index];
  }

  /** How far through the event showing now, 0 to 1. */
  get progress(): number {
    const e = this.current;
    const d = e ? eventSeconds(e, this.index === this.events.length - 1) : 0;
    return d > 0 ? Math.min(1, this.elapsed / d) : 1;
  }

  /** Moves time on; false once every event has shown. */
  step(deltaTime: number): boolean {
    this.elapsed += deltaTime;
    for (;;) {
      const e = this.current;
      if (!e) return false;
      const d = eventSeconds(e, this.index === this.events.length - 1);
      if (this.elapsed < d) return true;
      this.elapsed -= d;
      this.show(this.index + 1);
    }
  }

  private show(index: number): void {
    this.index = index;
    const e = this.events[index];
    if (!e) return;
    if (e.kind === 'turn' || e.kind === 'action' || e.kind === 'charge') this.actor = e.unitId;
    this.display = displayFight(this.base, e, this.actor);
  }
}
