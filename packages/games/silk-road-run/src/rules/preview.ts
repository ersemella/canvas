/**
 * Previews, computed in the browser from the view (D11, 7.2): what a turn
 * would do, and what each enemy could do on its next turn. They use the
 * same rules as the server, so a preview matches the outcome.
 */
import {hexEquals} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {isImmobilized, isStunned} from './board';
import {scoreOptions, simulate} from './ai';
import {aimSlot} from './track';
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
  const after = simulate(state, unitId, input);
  if (!after) return null;
  const unit = after.units.find((u) => u.id === unitId)!;
  return {
    changes: diff(state, after),
    slot: unit.slot,
    aimSlot: unit.alive ? aimSlot(after, unit, after.currentSlot, input.action.ability) : null,
    bumped: bumpedCards(state, after, unitId),
  };
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
