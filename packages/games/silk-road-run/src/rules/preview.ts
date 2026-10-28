/**
 * Previews, computed in the browser from the view (D11, 7.2): what a turn
 * would do, and what each enemy could do on its next turn. They use the
 * same rules as the server, so a preview matches the outcome.
 */
import {hexEquals} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {isImmobilized, isStunned} from './board';
import {scoreOptions, simulate} from './ai';
import {aimSlot, traceTrack} from './track';
import type {TrackStep} from './track';
import type {AbilityId, FightState, TurnInput, Unit} from './types';

export interface UnitChange {
  unitId: string;
  hpBefore: number;
  hpAfter: number;
  killed: boolean;
  from: Hex | null;
  to: Hex | null;
  /** Status changes in words, e.g. "Stunned". */
  statuses: string[];
}

export interface TurnPreview {
  changes: UnitChange[];
  /** The acting card's slot after the turn, yielding included. */
  slot: number | null;
  /**
   * The slot the turn aims the card at, before yielding (3.2, 3.3): when
   * it's taken, the card lands further on, at `slot`.
   */
  aimSlot: number | null;
  /** Other cards the acting card's landing moves on (3.3: a faster card takes a slower one's slot), by unit id. */
  bumped: Record<string, number>;
  /**
   * Every card the turn moves, by unit id, leg by leg as it goes: the
   * acting card's from `aimSlot`, the others' from the slot they hold now.
   * The track draws each leg by its cause, so a card both Hastened and
   * bumped on shows both.
   */
  moves: Record<string, CardLeg[]>;
}

/**
 * One leg of a card's move on the track: `earlier` or `later` where the
 * turn sends it (a Haste, a Delay, Omen, a swap), `bumped` on past taken
 * slots (3.3: it yields, or a faster card takes its slot).
 */
export interface CardLeg {
  from: number;
  to: number;
  cause: 'earlier' | 'later' | 'bumped';
}

function statusWords(before: Unit, after: Unit): string[] {
  const out: string[] = [];
  if (isStunned(after) && !isStunned(before)) out.push('Stunned');
  else if (isImmobilized(after) && !isImmobilized(before)) out.push('Immobilized');
  if (after.alive && !isStunned(after) && isStunned(before)) out.push('Released');
  if (after.empower && after.empower !== before.empower) out.push(`Empowered ${after.empower}`);
  if (after.weaken && after.weaken !== before.weaken) out.push(`Weakened ${after.weaken}`);
  if (after.unstoppable && !before.unstoppable) out.push('Unstoppable');
  return out;
}

/** What `input` would do for the acting unit, or null if it's illegal. */
export function previewTurn(
  state: FightState,
  unitId: string,
  input: TurnInput
): TurnPreview | null {
  const {result: after, steps} = traceTrack(() => simulate(state, unitId, input));
  if (!after) return null;
  const unit = after.units.find((u) => u.id === unitId)!;
  const aim = unit.alive ? aimSlot(after, unit, after.currentSlot, input.action.ability) : null;
  return {
    changes: diff(state, after),
    slot: unit.slot,
    aimSlot: aim,
    bumped: bumpedCards(state, after, unitId),
    moves: cardMoves(state, after, unitId, aim, steps),
  };
}

/**
 * Each card's legs (`TurnPreview.moves`) from the traced steps: the acting
 * card's from the slot its cost aims at, consecutive legs of one cause
 * joined. Should the steps not lead from where a card was to where it
 * lands, it is drawn as one leg.
 */
function cardMoves(
  before: FightState,
  after: FightState,
  actor: string,
  aim: number | null,
  steps: Map<string, TrackStep[]>
): Record<string, CardLeg[]> {
  const out: Record<string, CardLeg[]> = {};
  for (const a of after.units) {
    const b = before.units.find((u) => u.id === a.id)!;
    if (!a.alive || !b.alive || a.slot === null || b.slot === null) continue;
    let traced = steps.get(a.id) ?? [];
    let start = b.slot;
    if (a.id === actor) {
      if (aim === null) continue;
      // The turn's own placement leaves from the slot it aims at (`aimSlot`), not the current one.
      const i = traced.findIndex((s) => s.cause === 'placed' && s.from === b.slot);
      if (i < 0) continue;
      traced = [{...traced[i]!, from: aim}, ...traced.slice(i + 1)];
      start = aim;
    }
    const legs: CardLeg[] = [];
    for (const s of traced) {
      if (s.from === s.to) continue;
      const cause = s.cause === 'bumped' ? 'bumped' : s.to < s.from ? 'earlier' : 'later';
      const last = legs[legs.length - 1];
      if (last && last.cause === cause && last.to === s.from) last.to = s.to;
      else legs.push({from: s.from, to: s.to, cause});
    }
    const joined =
      legs.length > 0 &&
      legs[0]!.from === start &&
      legs[legs.length - 1]!.to === a.slot &&
      legs.every((l, k) => k === 0 || legs[k - 1]!.to === l.from);
    if (joined) out[a.id] = legs;
    else if (start !== a.slot)
      out[a.id] = [{from: start, to: a.slot, cause: a.slot < start ? 'earlier' : 'later'}];
  }
  return out;
}

function bumpedCards(before: FightState, after: FightState, actor: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of after.units) {
    const b = before.units.find((u) => u.id === a.id)!;
    if (a.id !== actor && a.alive && b.alive && a.slot !== b.slot && a.slot !== null)
      out[a.id] = a.slot;
  }
  return out;
}

export function diff(before: FightState, after: FightState): UnitChange[] {
  const out: UnitChange[] = [];
  for (const b of before.units) {
    if (!b.alive) continue;
    const a = after.units.find((u) => u.id === b.id)!;
    const moved = a.hex && b.hex ? !hexEquals(a.hex, b.hex) : a.hex !== b.hex;
    const statuses = statusWords(b, a);
    if (a.hp === b.hp && !moved && statuses.length === 0 && a.alive) continue;
    out.push({
      unitId: b.id,
      hpBefore: b.hp,
      hpAfter: a.hp,
      killed: !a.alive,
      from: b.hex,
      to: a.hex,
      statuses,
    });
  }
  return out;
}

export interface EnemyOption {
  ability: AbilityId;
  /** Units it could affect, with the most damage (negative: healing) it could deal each. */
  effects: {unitId: string; damage: number; statuses: string[]}[];
}

/**
 * What a unit could do if it acted now, per ability: every unit it could
 * affect from its current hex (D11); ordinary movement is a separate action. Never which option it will
 * choose: no scores, listed in ability order.
 */
export function unitOptions(state: FightState, unit: Unit): EnemyOption[] {
  const byAbility = new Map<AbilityId, Map<string, {damage: number; statuses: Set<string>}>>();
  for (const option of scoreOptions(state, unit)) {
    const ability = option.input.action.ability;
    if (ability === 'hold') continue;
    if (!byAbility.has(ability)) byAbility.set(ability, new Map());
    const effects = byAbility.get(ability)!;
    for (const c of diff(state, option.after)) {
      if (c.unitId === unit.id && c.hpAfter === c.hpBefore && c.statuses.length === 0) continue;
      const e = effects.get(c.unitId) ?? {damage: -Infinity, statuses: new Set<string>()};
      e.damage = Math.max(e.damage, c.hpBefore - c.hpAfter);
      for (const s of c.statuses) e.statuses.add(s);
      effects.set(c.unitId, e);
    }
  }
  return [...byAbility].map(([ability, effects]) => ({
    ability,
    effects: [...effects].map(([unitId, e]) => ({
      unitId,
      damage: e.damage,
      statuses: [...e.statuses],
    })),
  }));
}
