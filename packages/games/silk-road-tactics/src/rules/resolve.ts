/**
 * Effects every ability is built from: damage (brief section 2's order),
 * healing, entering a hex, displacement, death and the end of the fight.
 */
import {hexEquals, hexNeighbor} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {RULES, HEROES} from './config';
import {addStatus, onMap, unitAt, vulnerablePercent} from './board';
import {tileAt} from './map';
import type {MapData} from './map';
import type {FightState, Unit} from './types';

export interface Ctx {
  state: FightState;
  map: MapData;
  /** The slot the turn happens on (durations count from it). */
  slot: number;
}

export function log(ctx: Ctx, text: string): void {
  ctx.state.log.push({slot: ctx.slot, text});
  if (ctx.state.log.length > 200) ctx.state.log.splice(0, ctx.state.log.length - 200);
}

export function unitName(u: Unit): string {
  return `${u.side === 'player' ? 'Your' : 'Enemy'} ${HEROES[u.hero].name}`;
}

/** base × (1 + power / 50), rounded down: power scales base damage and healing. */
export function scaled(base: number, power: number): number {
  return Math.floor(base * (1 + power / 50));
}

/**
 * An ability's hit (brief section 2): scaled base, then −50% if ranged on
 * conceal, then Vulnerable (max of ability and flank), then defence;
 * minimum 1. Each step rounds down.
 */
export function abilityDamage(
  state: FightState,
  map: MapData,
  attacker: Unit,
  target: Unit,
  base: number,
  ranged: boolean
): number {
  let d = scaled(base, attacker.power);
  if (ranged && target.hex && tileAt(map, target.hex) === 'conceal') d = Math.floor(d * (1 - RULES.concealReduction));
  d = Math.floor(d * (1 + vulnerablePercent(state, target) / 100));
  d = Math.floor((d * RULES.defenceConstant) / (target.defence + RULES.defenceConstant));
  return Math.max(RULES.minimumDamage, d);
}

/** Hazard and collision damage: skip defence, still take Vulnerable. */
export function rawDamage(state: FightState, target: Unit, amount: number): number {
  return Math.floor(amount * (1 + vulnerablePercent(state, target) / 100));
}

export function hit(ctx: Ctx, attacker: Unit, target: Unit, base: number, ranged: boolean, what: string): void {
  if (!target.alive) return;
  const d = abilityDamage(ctx.state, ctx.map, attacker, target, base, ranged);
  applyDamage(ctx, target, d, `${what} hits ${unitName(target)} for ${d}`);
}

export function applyDamage(ctx: Ctx, target: Unit, amount: number, text: string): void {
  if (!target.alive) return;
  target.hp = Math.max(0, target.hp - amount);
  log(ctx, `${text}.`);
  if (target.hp === 0) kill(ctx, target);
}

export function heal(ctx: Ctx, target: Unit, amount: number): void {
  if (!target.alive) return;
  const healed = Math.min(amount, target.maxHp - target.hp);
  target.hp += healed;
  if (healed > 0) log(ctx, `${unitName(target)} heals ${healed}.`);
}

export function kill(ctx: Ctx, unit: Unit): void {
  unit.alive = false;
  unit.slot = null;
  unit.charging = null;
  unit.hex = null;
  log(ctx, `${unitName(unit)} falls.`);
  checkEnd(ctx.state);
}

export function checkEnd(state: FightState): void {
  if (state.phase !== 'fight') return;
  if (!state.units.some((u) => u.alive && u.side === 'enemy')) state.phase = 'won';
  else if (!state.units.some((u) => u.alive && u.side === 'player')) state.phase = 'lost';
}

/** Hail on a hex applies its statuses to whoever is there. */
export function applyHail(ctx: Ctx, unit: Unit): void {
  if (!unit.alive || !unit.hex) return;
  const hail = ctx.state.effects.find((e) => hexEquals(e.hex, unit.hex!));
  if (!hail) return;
  const untilSlot = ctx.slot + hail.statusSlots;
  addStatus(unit, {kind: 'slowed', value: hail.slowed, untilSlot});
  addStatus(unit, {kind: 'vulnerable', value: hail.vulnerable, untilSlot});
  log(ctx, `Hail batters ${unitName(unit)}: Slowed ${hail.slowed}, Vulnerable ${hail.vulnerable}%`);
}

/** Quicksand under a unit: on entering, and at the start of each turn on it. */
export function applyHazard(ctx: Ctx, unit: Unit): void {
  if (!unit.alive || !unit.hex || tileAt(ctx.map, unit.hex) !== 'hazard') return;
  const d = rawDamage(ctx.state, unit, RULES.hazardDamage);
  applyDamage(ctx, unit, d, `Quicksand drags at ${unitName(unit)} for ${d}`);
}

/** Moves a unit onto a hex; `triggers` applies the hex's hazard and hail. */
export function enterHex(ctx: Ctx, unit: Unit, h: Hex, triggers = true): void {
  unit.hex = h;
  if (!triggers) return;
  applyHazard(ctx, unit);
  applyHail(ctx, unit);
}

/**
 * Displace N along a hex direction (17.4): stops early at an obstacle,
 * another unit or the map edge, dealing collision damage to the displaced
 * unit and to a unit it hits (ignoring defence). Entering quicksand
 * triggers it. Doesn't move the card.
 */
export function displace(ctx: Ctx, unit: Unit, direction: number, distance: number): void {
  for (let i = 0; i < distance && unit.alive && unit.hex; i++) {
    const next = hexNeighbor(unit.hex, direction);
    const other = unitAt(ctx.state, next);
    if (!onMap(ctx.map, next) || tileAt(ctx.map, next) === 'obstacle' || other) {
      const d = rawDamage(ctx.state, unit, RULES.collisionDamage);
      if (other) {
        const d2 = rawDamage(ctx.state, other, RULES.collisionDamage);
        applyDamage(ctx, unit, d, `${unitName(unit)} slams into ${unitName(other)} for ${d}`);
        applyDamage(ctx, other, d2, `${unitName(other)} takes ${d2} from the collision`);
      } else {
        applyDamage(ctx, unit, d, `${unitName(unit)} is slammed into ${onMap(ctx.map, next) ? 'ruins' : 'the edge'} for ${d}`);
      }
      return;
    }
    enterHex(ctx, unit, next);
  }
}
