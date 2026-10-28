/**
 * Playing back what a turn set off (the player's turn and the AI turns
 * after it), one event at a time, so the board doesn't jump from before to
 * after. The rules record the events with a snapshot of the board after
 * each (`FightState.events`); this keeps the time and builds the fight to
 * draw at each step. The board system draws it and each event's flourish.
 */
import {hexDistance, hexEquals} from '@canvas/engine/server';
import {ABILITY} from '../rules/config';
import type {Hex} from '@canvas/engine/server';
import type {FightState, HailEffect, RecordedEvent} from '../rules/types';

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
      if (e.how === 'throw') return 0.32;
      return Math.max(WALK_SECONDS, 0.08 * hexDistance(e.from, e.to));
    case 'action':
      if (e.ability === 'hold') return 0;
      // The sunbeam takes longer to read.
      if (e.ability === 'sunlight') return 0.85;
      return 0.5;
    case 'land':
      return 0.5;
    case 'damage':
    case 'heal':
      return 0.45;
    case 'death':
      return 0.5;
    case 'skip':
      return 0.7;
  }
}

/**
 * The fight to draw once an event has happened: the fight before the turn,
 * with each unit's position, health and card, the hail, the shots in the
 * air and the slot from
 * the event's snapshot. The unit whose turn it is shows as acting.
 * Statuses stay as they were until the playback ends, but for a Grapple's
 * hold (`withGrapple`).
 */
export function displayFight(base: FightState, e: RecordedEvent, actor: string | null): FightState {
  const after = e.after;
  // The fires and the fan as they were then, not as the turn left them.
  const {fires: _fires, fan: _fan, ...rest} = base;
  return {
    ...rest,
    phase: 'fight',
    currentSlot: after.currentSlot,
    effects:
      e.kind === 'action' && e.ability === 'hail' && e.target
        ? castHail(after.effects, e.unitId, e.target)
        : after.effects,
    shots: after.shots ?? [],
    ...(after.fires ? {fires: after.fires} : {}),
    ...(after.fan ? {fan: after.fan} : {}),
    awaiting: actor,
    units: base.units.map((u) => ({...u, ...after.units.find((v) => v.id === u.id)})),
  };
}

/**
 * The hail as it falls the moment Hail is cast: the action is recorded
 * before it resolves, so its snapshot lacks the new hail. Placed as the
 * rules place it (Hail's `resolve`): over any on its space, the caster's
 * oldest lifting past `ABILITY.hail.max`.
 */
function castHail(effects: HailEffect[], source: string, hex: HailEffect['hex']): HailEffect[] {
  const mine = effects.filter((h) => h.source === source);
  const lifts = mine.slice(0, Math.max(0, mine.length - Math.max(1, ABILITY.hail.max) + 1));
  return [
    ...effects.filter((h) => !lifts.includes(h) && !hexEquals(h.hex, hex)),
    {kind: 'hail', hex, source, turns: ABILITY.hail.turns},
  ];
}

/**
 * The fight with a Grapple's hold shown from the moment it's used, rather
 * than once the playback ends, so its fists show at once: `unitId` holds
 * the unit on `target`, letting go of any other. Nothing if `target` isn't
 * a grab (a throw onto a free space, a swap on its own).
 */
function withGrapple(fight: FightState, unitId: string, target: Hex): FightState {
  const held = fight.units.find((u) => u.alive && u.hex && hexEquals(u.hex, target));
  if (!held || held.id === unitId) return fight;
  return {
    ...fight,
    units: fight.units.map((u) => {
      const statuses = u.statuses.filter((s) => s.grapple?.champion !== unitId);
      if (u.id === held.id)
        statuses.push({kind: 'stunned', grapple: {champion: unitId, target: u.id}});
      return {...u, statuses};
    }),
  };
}

/**
 * A new fight's opening, for a board that has nothing to play back from:
 * the cards as first placed (the first event records the board before
 * anyone has acted), then everything up to the player's first turn. Null if there's nothing recorded.
 */
export function openingPlayback(to: FightState): PlaybackPayload | null {
  const first = to.events?.[0];
  if (!first) return null;
  const shown = displayFight(to, first, null);
  // Nothing has happened yet: no statuses, no log.
  const from = {...shown, units: shown.units.map((u) => ({...u, statuses: []})), log: []};
  return {from, to};
}

export class Playback {
  readonly events: RecordedEvent[];
  /** The event showing now. */
  index = 0;
  /** Seconds into it. */
  elapsed = 0;
  /** The board as of the event showing now. */
  display: FightState;
  private base: FightState;
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
    if (e.kind === 'turn' || e.kind === 'action' || e.kind === 'land' || e.kind === 'skip')
      this.actor = e.unitId;
    if (e.kind === 'action' && e.ability === 'grapple' && e.target)
      this.base = withGrapple(displayFight(this.base, e, this.actor), e.unitId, e.target);
    this.display = displayFight(this.base, e, this.actor);
  }
}
