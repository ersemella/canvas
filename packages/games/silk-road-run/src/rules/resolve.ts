/**
 * Effects every ability is built from: damage (brief section 2's order),
 * healing, entering a hex, displacement, death and the end of the fight.
 */
import {hexDistance, hexEquals, hexNeighbor} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITY, CAMEL, RULES, HEROES} from './config';
import {barrierOf, onMap, statusValue, unitAt, vulnerablePercent} from './board';
import {MAPS, tileAt} from './map';
import type {MapData} from './map';
import {pushCard} from './track';
import type {BoardSnapshot, FightEvent, FightState, HailEffect, Motion, Unit} from './types';

export interface Ctx {
  state: FightState;
  map: MapData;
  /** The slot the turn happens on (durations count from it). */
  slot: number;
}

export function log(ctx: Ctx, text: string): void {
  logAt(ctx.state, ctx.slot, text);
}

/** Adds a log line, keeping the last 200. */
function logAt(state: FightState, slot: number, text: string): void {
  state.log.push({slot, text});
  if (state.log.length > 200) state.log.splice(0, state.log.length - 200);
}

/** A fight records at most this many events per action (a safety bound). */
const MAX_EVENTS = 400;

/** Records an event with the board as it is now, if this fight records (see `FightState.events`). */
export function record(state: FightState, event: FightEvent): void {
  const events = state.events;
  if (!events || events.length >= MAX_EVENTS) return;
  events.push({...event, after: snapshot(state)});
}

function snapshot(state: FightState): BoardSnapshot {
  return {
    currentSlot: state.currentSlot,
    units: state.units.map((u) => ({
      id: u.id,
      hex: u.hex ? {...u.hex} : null,
      hp: u.hp,
      alive: u.alive,
      slot: u.slot,
      charging: u.charging ? {...u.charging, target: {...u.charging.target}} : null,
      skipped: u.skipped ?? false,
    })),
    effects: state.effects.map((e) => ({...e, hex: {...e.hex}})),
  };
}

export function unitName(u: Unit): string {
  if (u.hero === CAMEL && u.side === 'player') return HEROES.camel.name;
  return `${u.side === 'player' ? 'Your' : 'Enemy'} ${HEROES[u.hero].name}`;
}

/** base × (1 + power / 50), rounded down: power scales base damage and healing. */
export function scaled(base: number, power: number): number {
  return Math.floor(base * (1 + power / 50));
}

/**
 * An ability's hit (brief section 2): scaled base, then Vulnerable (max of
 * ability and flank), then defence; minimum 1. Each step rounds down.
 * Obscured no longer weakens ranged hits: it stops them being aimed
 * (owner, 2026-10-21; board.ts).
 */
export function abilityDamage(
  state: FightState,
  attacker: Unit,
  target: Unit,
  base: number
): number {
  return throughDefence(state, target, scaled(base, attacker.power));
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

/** Vulnerable alone: collision damage, which skips defence. */
export function rawDamage(state: FightState, target: Unit, amount: number): number {
  return Math.floor(amount * (1 + vulnerablePercent(state, target) / 100));
}

export function hit(ctx: Ctx, attacker: Unit, target: Unit, base: number, what: string): void {
  if (!target.alive) return;
  const raw = rawDamage(ctx.state, target, scaled(base, attacker.power));
  strike(ctx, target, raw, true, (d) => `${what} hits ${unitName(target)} for ${d}`);
}

/**
 * Damage reaching a unit, `raw` after Vulnerable. A Barrier takes it first,
 * at its full value, skipping defence, and whatever it couldn't absorb is
 * lost: none of it reaches health (owner, 2026-10-22). Without one,
 * defence (when `defence`) and the minimum, then health; `text` says so.
 */
export function strike(
  ctx: Ctx,
  target: Unit,
  raw: number,
  defence: boolean,
  text: (d: number) => string
): void {
  if (!target.alive) return;
  if (absorb(ctx, target, raw)) return;
  const d = defence ? defended(target, raw) : raw;
  applyDamage(ctx, target, d, text(d));
}

/** If the unit has a Barrier, it takes `raw`, breaking once spent; true if it did. */
function absorb(ctx: Ctx, target: Unit, raw: number, quiet = false): boolean {
  const barrier = barrierOf(target);
  if (!barrier) return false;
  barrier.value -= raw;
  if (barrier.value <= 0) target.statuses = target.statuses.filter((s) => s !== barrier);
  if (!quiet) logBarrier(ctx, target, raw);
  return true;
}

function logBarrier(ctx: Ctx, target: Unit, raw: number): void {
  const left = barrierOf(target)?.value ?? 0;
  log(
    ctx,
    `${unitName(target)}'s barrier takes ${raw}${left > 0 ? `, ${left} left` : ' and breaks'}.`
  );
  record(ctx.state, {kind: 'damage', unitId: target.id, amount: 0});
}

/** Push N on the track (17.3), within the push limit (3.6). An Inevitable card doesn't move. */
export function push(ctx: Ctx, unit: Unit, n: number): void {
  if (!unit.alive || unit.slot === null) return;
  if (inevitable(unit)) {
    log(ctx, `${unitName(unit)} is Inevitable: its card doesn't move.`);
    return;
  }
  const moved = pushCard(ctx.state, unit, n);
  log(
    ctx,
    moved > 0
      ? `${unitName(unit)} is pushed back ${moved} slot${moved === 1 ? '' : 's'}.`
      : `${unitName(unit)} can't be pushed further this turn.`
  );
}

export function applyDamage(ctx: Ctx, target: Unit, amount: number, text: string): void {
  if (!target.alive) return;
  target.hp = Math.max(0, target.hp - amount);
  log(ctx, `${text}.`);
  record(ctx.state, {kind: 'damage', unitId: target.id, amount});
  if (target.hp === 0) kill(ctx, target);
}

export function heal(ctx: Ctx, target: Unit, amount: number): void {
  if (!target.alive) return;
  const healed = Math.min(amount, target.maxHp - target.hp);
  target.hp += healed;
  if (healed > 0) {
    log(ctx, `${unitName(target)} heals ${healed}.`);
    record(ctx.state, {kind: 'heal', unitId: target.id, amount: healed});
  }
}

export function kill(ctx: Ctx, unit: Unit): void {
  const at = unit.hex;
  unit.alive = false;
  unit.slot = null;
  unit.charging = null;
  unit.hex = null;
  log(ctx, `${unitName(unit)} falls.`);
  if (at) record(ctx.state, {kind: 'death', unitId: unit.id, hex: at});
  checkEnd(ctx.state);
}

export function checkEnd(state: FightState): void {
  if (state.phase !== 'fight') return;
  const camel = camelOf(state);
  // The camel's death counts first: one action that also beats the last
  // enemy, or carries the camel onto an exit as it dies, is a loss.
  if (camel && !camel.alive) state.phase = 'lost';
  else if (!state.units.some((u) => u.alive && u.side === 'enemy')) state.phase = 'won';
  else if (camel?.hex && atExit(state, camel.hex)) {
    state.phase = 'won';
    logAt(state, state.currentSlot, `${unitName(camel)} reaches the road out.`);
  } else if (!state.units.some((u) => u.alive && u.side === 'player' && u !== camel))
    state.phase = 'lost';
}

/** The player's camel (camel.md). */
export function camelOf(state: FightState): Unit | undefined {
  return state.units.find((u) => u.hero === CAMEL);
}

/** Whether `h` is one of the fight's exits, which the camel wins by reaching. */
export function atExit(state: FightState, h: Hex): boolean {
  return MAPS[state.mapId]!.exits.some((e) => hexEquals(e, h));
}

/** Inevitable (17.3): the card can't be moved by Push or Pull, from either side. The Bökh Champion's passive. */
export function inevitable(unit: Unit): boolean {
  return HEROES[unit.hero].passive === 'inevitable';
}

/** The hail on `h`, if any. */
export function hailAt(state: FightState, h: Hex): HailEffect | undefined {
  return state.effects.find((e) => hexEquals(e.hex, h));
}

/**
 * The Push `unit` owes for starting its turn on hail, applied once the
 * turn has placed its card (owner, 2026-10-22, playtest); 0 off hail or
 * when Inevitable.
 */
export function hailPushOwed(state: FightState, unit: Unit): number {
  if (!unit.alive || !unit.hex || inevitable(unit)) return 0;
  return hailAt(state, unit.hex)?.push ?? 0;
}

/** Applies a turn's owed Push from hail, said as hail's. */
export function hailPush(ctx: Ctx, unit: Unit, n: number): void {
  if (n <= 0 || !unit.alive) return;
  log(ctx, `Hail batters ${unitName(unit)}.`);
  push(ctx, unit, n);
}

/** Quicksand under a unit, on entering (each slot on it is `damageEachSlot`). */
export function applyHazard(ctx: Ctx, unit: Unit): void {
  if (!onQuicksand(ctx.map, unit)) return;
  strike(
    ctx,
    unit,
    rawDamage(ctx.state, unit, RULES.hazardEnterDamage),
    true,
    (d) => `Quicksand drags at ${unitName(unit)} for ${d}`
  );
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
 * points a slot aren't rounded away. A Barrier takes each slot's damage
 * as it comes, at full value, until it breaks. One log line per unit and cause.
 */
export function damageEachSlot(ctx: Ctx, from: number, expire: (slot: number) => void): void {
  const sinking = new Map<Unit, number>();
  const crushed = new Map<Unit, number>();
  const absorbed = new Map<Unit, number>();
  const add = (m: Map<Unit, number>, u: Unit, d: number) => m.set(u, (m.get(u) ?? 0) + d);
  const tick = (m: Map<Unit, number>, u: Unit, d: number) =>
    absorb(ctx, u, d, true) ? add(absorbed, u, d) : add(m, u, d);
  for (let s = from + 1; s <= ctx.slot; s++) {
    expire(s);
    for (const u of ctx.state.units) {
      if (!u.alive) continue;
      if (onQuicksand(ctx.map, u)) tick(sinking, u, rawDamage(ctx.state, u, RULES.hazardDamage));
      const crush = statusValue(u, 'crushed');
      if (crush > 0) tick(crushed, u, rawDamage(ctx.state, u, crush));
    }
  }
  for (const [u, raw] of absorbed) logBarrier(ctx, u, raw);
  for (const [u, raw] of sinking) {
    const d = defended(u, raw);
    applyDamage(ctx, u, d, `Quicksand drags at ${unitName(u)} for ${d}`);
  }
  for (const [u, raw] of crushed) {
    const d = defended(u, raw);
    applyDamage(ctx, u, d, `The grapple crushes ${unitName(u)} for ${d}`);
  }
}

/**
 * Moves a unit onto a hex; `triggers` applies the hex's hazard (hail acts
 * when it lands and at the start of a turn, not on entering).
 * `how` is how it got there, for the page's playback.
 */
export function enterHex(
  ctx: Ctx,
  unit: Unit,
  h: Hex,
  triggers = true,
  how: Motion = 'walk'
): void {
  const from = unit.hex;
  unit.hex = h;
  if (from) record(ctx.state, {kind: 'step', unitId: unit.id, from, to: h, how});
  breakPins(ctx, unit);
  if (!triggers) return;
  applyHazard(ctx, unit);
}

/**
 * A Grapple lasts until it breaks: when the Champion and target are no
 * longer within Grapple's range of each other (owner, 2026-10-22; was
 * adjacent), either displaced away, or the Champion moving away: it isn't
 * held itself (owner, 2026-10-20). Breaking it clears every status the
 * Grapple gave either unit (owner, 2026-10-20).
 */
export function breakPins(ctx: Ctx, unit: Unit): void {
  const byId = (id: string) => ctx.state.units.find((u) => u.id === id);
  for (const holder of ctx.state.units) {
    for (const {grapple} of holder.statuses) {
      if (!grapple || (grapple.champion !== unit.id && grapple.target !== unit.id)) continue;
      const a = byId(grapple.champion)?.hex;
      const b = byId(grapple.target)?.hex;
      const holds = !!a && !!b && hexDistance(a, b) <= ABILITY.grapple.range;
      if (holds) continue;
      for (const u of ctx.state.units)
        u.statuses = u.statuses.filter(
          (s) => s.grapple?.champion !== grapple.champion || s.grapple.target !== grapple.target
        );
      log(ctx, `The grapple on ${unitName(byId(grapple.target)!)} is broken.`);
      // The statuses changed under this loop; look again for any other grapple.
      return breakPins(ctx, unit);
    }
  }
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
      const raw = rawDamage(ctx.state, unit, RULES.collisionDamage);
      if (other) {
        const raw2 = rawDamage(ctx.state, other, RULES.collisionDamage);
        strike(
          ctx,
          unit,
          raw,
          false,
          (d) => `${unitName(unit)} slams into ${unitName(other)} for ${d}`
        );
        strike(ctx, other, raw2, false, (d) => `${unitName(other)} takes ${d} from the collision`);
      } else {
        const what = onMap(ctx.map, next) ? 'ruins' : 'the edge';
        strike(ctx, unit, raw, false, (d) => `${unitName(unit)} is slammed into ${what} for ${d}`);
      }
      return;
    }
    enterHex(ctx, unit, next, true, 'push');
  }
}
