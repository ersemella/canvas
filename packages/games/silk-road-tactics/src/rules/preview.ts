/**
 * Previews, computed in the browser from the view (D11, 7.2): what a turn
 * would do, and what each enemy could do on its next turn. They use the
 * same rules as the server, so a preview matches the outcome.
 */
import {hexEquals} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {statusValue, statusSlotsLeft} from './board';
import {ABILITIES} from './abilities';
import {scoreOptions, simulate} from './ai';
import {RuleError, applyTurn, cloneFight} from './fight';
import {slotsForward, turnCost} from './track';
import type {AbilityId, FightState, TurnAction, TurnInput, Unit} from './types';

export interface UnitChange {
  unitId: string;
  hpBefore: number;
  hpAfter: number;
  killed: boolean;
  from: Hex | null;
  to: Hex | null;
  /** Status changes in words, e.g. "Slowed 2". */
  statuses: string[];
}

export interface TurnPreview {
  changes: UnitChange[];
  /** The acting card's slot after the turn, yielding included. */
  slot: number | null;
  /**
   * The slot the turn's cost aims the card at, before yielding (3.2, 3.3):
   * when it's taken, the card lands further on, at `slot`.
   */
  aimSlot: number | null;
  /** A charged ability: it triggers later, and the changes assume no one moves. */
  charged: boolean;
}

function statusWords(before: Unit, after: Unit, slot: number): string[] {
  const out: string[] = [];
  const slowed = statusValue(after, 'slowed');
  if (slowed > statusValue(before, 'slowed')) out.push(`Slowed ${slowed}`);
  const vuln = statusValue(after, 'vulnerable');
  if (vuln > statusValue(before, 'vulnerable')) out.push(`Vulnerable ${vuln}%`);
  const imm = statusSlotsLeft(after, 'immobilized', slot);
  if (imm > statusSlotsLeft(before, 'immobilized', slot)) out.push(`Immobilized ${imm} slots`);
  const crush = statusValue(after, 'crushed');
  if (
    crush > 0 &&
    statusSlotsLeft(after, 'crushed', slot) > statusSlotsLeft(before, 'crushed', slot)
  )
    out.push(`Crushed ${crush} a slot`);
  const taunt = statusSlotsLeft(after, 'taunted', slot);
  if (taunt > statusSlotsLeft(before, 'taunted', slot)) out.push(`Taunted ${taunt} slots`);
  if (before.statuses.length > 0 && after.statuses.length === 0 && after.alive)
    out.push('Cleansed');
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
  const cost = turnCost(ABILITIES[input.action.ability].cost, input.move?.length ?? 0);
  return {
    changes: diff(state, after),
    slot: unit.slot,
    aimSlot: unit.alive ? state.currentSlot + slotsForward(cost, unit.speed) : null,
    charged: ABILITIES[input.action.ability].charged,
  };
}

/**
 * The fight just after `unitId` takes `action`, before any move: where an
 * act-then-move turn moves from (an ability may have moved or Immobilized
 * the unit). Null if the action is illegal.
 */
export function afterAction(
  state: FightState,
  unitId: string,
  action: TurnAction
): {state: FightState; unit: Unit} | null {
  const sim = cloneFight(state);
  const unit = sim.units.find((u) => u.id === unitId)!;
  try {
    applyTurn(sim, unit, {action, actFirst: true});
  } catch (e) {
    if (e instanceof RuleError) return null;
    throw e;
  }
  return {state: sim, unit};
}

export function diff(before: FightState, after: FightState): UnitChange[] {
  const out: UnitChange[] = [];
  for (const b of before.units) {
    if (!b.alive) continue;
    const a = after.units.find((u) => u.id === b.id)!;
    const moved = a.hex && b.hex ? !hexEquals(a.hex, b.hex) : a.hex !== b.hex;
    const statuses = statusWords(b, a, before.currentSlot);
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
 * affect from any hex it can reach (D11). Never which option it will
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
