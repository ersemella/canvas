/**
 * Effects every ability is built from: damage (brief section 2's order),
 * healing, entering a hex, displacement, death and the end of the fight.
 */
import {hexDistance, hexEquals, hexNeighbor} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITY, RULES, HEROES} from './config';
import {addStatus, fogAt, onMap, statusValue, unitAt, vulnerablePercent} from './board';
import {tileAt} from './map';
import type {MapData} from './map';
import type {FightState, HailEffect, Unit} from './types';

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
 * An ability's hit (brief section 2): scaled base, then if ranged −50% on
 * conceal or into fog (once), −50% out of fog, then Vulnerable (max of
 * ability and flank), then defence; minimum 1. Each step rounds down.
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
  if (ranged && target.hex) {
    if (tileAt(map, target.hex) === 'conceal') d = Math.floor(d * (1 - RULES.concealReduction));
    else if (fogAt(state, target.hex)) d = Math.floor(d * (1 - ABILITY.fog.reduction));
  }
  if (ranged && attacker.hex && fogAt(state, attacker.hex))
    d = Math.floor(d * (1 - ABILITY.fog.reduction));
  return throughDefence(state, target, d);
}

/** Vulnerable, then defence, then the minimum: the end of every ability's hit, and of quicksand's. */
export function throughDefence(state: FightState, target: Unit, damage: number): number {
  return defended(target, rawDamage(state, target, damage));
}

/** Defence, then the minimum. */
function defended(target: Unit, damage: number): number {
  const d = Math.floor((damage * RULES.defenceConstant) / (target.defence + RULES.defenceConstant));
  return Math.max(RULES.minimumDamage, d);
}

/** What a hail hex deals its occupant: the scaled damage it was cast with, through Vulnerable and defence. */
export function hailDamage(state: FightState, target: Unit, hail: HailEffect): number {
  // Hail saved in a fight from before hail dealt damage has no `damage`.
  return throughDefence(state, target, hail.damage ?? 0);
}

/** Vulnerable alone: collision damage, which skips defence. */
export function rawDamage(state: FightState, target: Unit, amount: number): number {
  return Math.floor(amount * (1 + vulnerablePercent(state, target) / 100));
}

export function hit(
  ctx: Ctx,
  attacker: Unit,
  target: Unit,
  base: number,
  ranged: boolean,
  what: string
): void {
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

/** Hail on a hex hits whoever is there, then applies its statuses (so its own Vulnerable waits for the next hit). */
export function applyHail(ctx: Ctx, unit: Unit): void {
  if (!unit.alive || !unit.hex) return;
  const hail = ctx.state.effects.find((e) => hexEquals(e.hex, unit.hex!));
  if (!hail) return;
  const d = hailDamage(ctx.state, unit, hail);
  applyDamage(ctx, unit, d, `Hail strikes ${unitName(unit)} for ${d}`);
  if (!unit.alive) return;
  const untilSlot = ctx.slot + hail.statusSlots;
  addStatus(unit, {kind: 'slowed', value: hail.slowed, untilSlot});
  addStatus(unit, {kind: 'vulnerable', value: hail.vulnerable, untilSlot});
  log(ctx, `Hail batters ${unitName(unit)}: Slowed ${hail.slowed}, Vulnerable ${hail.vulnerable}%`);
}

/** Quicksand under a unit, on entering (each slot on it is `damageEachSlot`). */
export function applyHazard(ctx: Ctx, unit: Unit): void {
  if (!onQuicksand(ctx.map, unit)) return;
  const d = throughDefence(ctx.state, unit, RULES.hazardEnterDamage);
  applyDamage(ctx, unit, d, `Quicksand drags at ${unitName(unit)} for ${d}`);
}

function onQuicksand(map: MapData, unit: Unit): boolean {
  return unit.alive && !!unit.hex && tileAt(map, unit.hex) === 'hazard';
}

/**
 * The track moves from slot `from` to `ctx.slot`: every unit on quicksand,
 * and every Crushed unit, takes its damage for each slot passed, `from`
 * excluded, whether or not anyone's card was on it. `expire` runs at each
 * slot first, so Vulnerable and Crushed count only while they last.
 * Vulnerable applies slot by slot, defence once to the total, so a few
 * points a slot aren't rounded away. One log line per unit and cause.
 */
export function damageEachSlot(ctx: Ctx, from: number, expire: (slot: number) => void): void {
  const sinking = new Map<Unit, number>();
  const crushed = new Map<Unit, number>();
  const add = (m: Map<Unit, number>, u: Unit, d: number) => m.set(u, (m.get(u) ?? 0) + d);
  for (let s = from + 1; s <= ctx.slot; s++) {
    expire(s);
    for (const u of ctx.state.units) {
      if (!u.alive) continue;
      if (onQuicksand(ctx.map, u)) add(sinking, u, rawDamage(ctx.state, u, RULES.hazardDamage));
      const crush = statusValue(u, 'crushed');
      if (crush > 0) add(crushed, u, rawDamage(ctx.state, u, crush));
    }
  }
  for (const [u, raw] of sinking) {
    const d = defended(u, raw);
    applyDamage(ctx, u, d, `Quicksand drags at ${unitName(u)} for ${d}`);
  }
  for (const [u, raw] of crushed) {
    const d = defended(u, raw);
    applyDamage(ctx, u, d, `The pin crushes ${unitName(u)} for ${d}`);
  }
}

/** Moves a unit onto a hex; `triggers` applies the hex's hazard and hail. */
export function enterHex(ctx: Ctx, unit: Unit, h: Hex, triggers = true): void {
  unit.hex = h;
  breakPins(ctx, unit);
  if (!triggers) return;
  applyHazard(ctx, unit);
  applyHail(ctx, unit);
}

/**
 * A Pin Immobilizes the Champion and its target until the pin breaks: when
 * the target is cleansed, or when the two are no longer adjacent (either
 * displaced away, or the target walking off once cleansed). Breaking it
 * frees both; the target's other statuses stay (owner, 2026-10-20). Throw
 * lands the target beside the Champion, so Pin then Throw holds both.
 */
export function breakPins(ctx: Ctx, unit: Unit, cleansed = false): void {
  const byId = (id: string) => ctx.state.units.find((u) => u.id === id);
  const broken = new Set<string>();
  for (const holder of ctx.state.units) {
    holder.statuses = holder.statuses.filter((s) => {
      const pin = s.kind === 'immobilized' ? s.pin : undefined;
      if (!pin || (pin.champion !== unit.id && pin.target !== unit.id)) return true;
      const a = byId(pin.champion)?.hex;
      const b = byId(pin.target)?.hex;
      const holds = !(cleansed && pin.target === unit.id) && !!a && !!b && hexDistance(a, b) <= 1;
      if (!holds) broken.add(pin.target);
      return holds;
    });
  }
  for (const id of broken) log(ctx, `The pin on ${unitName(byId(id)!)} is broken.`);
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
        applyDamage(
          ctx,
          unit,
          d,
          `${unitName(unit)} is slammed into ${onMap(ctx.map, next) ? 'ruins' : 'the edge'} for ${d}`
        );
      }
      return;
    }
    enterHex(ctx, unit, next);
  }
}
