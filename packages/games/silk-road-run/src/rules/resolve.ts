/**
 * Effects every ability is built from: damage, entering a space, hail and
 * grapples ending, death and the end of the fight.
 */
import {hexDistance, hexEquals} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITY, CAMEL, HEROES} from './config';
import {addStatus, hailOn, shotLane, unitAt} from './board';
import {MAPS} from './map';
import type {MapData} from './map';
import type {BoardSnapshot, FightEvent, FightState, Motion, ShotInAir, Status, Unit} from './types';

export interface Ctx {
  state: FightState;
  map: MapData;
  /** The slot the turn happens on. */
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
      skipped: u.skipped ?? false,
    })),
    effects: state.effects.map((e) => ({...e, hex: {...e.hex}})),
    ...(state.shots?.length ? {shots: state.shots.map((v) => ({...v}))} : {}),
  };
}

export function unitName(u: Unit): string {
  if (u.hero === CAMEL && u.side === 'player') return HEROES.camel.name;
  return `${u.side === 'player' ? 'Your' : 'Enemy'} ${HEROES[u.hero].name}`;
}

/**
 * An ability's hit: exactly the attacker's power in damage (owner,
 * 2026-10-23), plus its Enhance (or `enhance`, one the hit carries from
 * when it was made). Power 0 deals none, and says nothing.
 */
export function hit(
  ctx: Ctx,
  attacker: Unit,
  target: Unit,
  what: string,
  enhance = attacker.enhance ?? 0
): void {
  const amount = damageOf(attacker, enhance);
  if (!target.alive || amount <= 0) return;
  if (enhance) log(ctx, `Enhance adds ${amount - attacker.power}.`);
  applyDamage(ctx, target, amount, `${what} hits ${unitName(target)} for ${amount}`);
}

/** An ability's damage (17.6, step 1): power plus Enhance, at least 0. */
export function damageOf(attacker: Unit, enhance = attacker.enhance ?? 0): number {
  return Math.max(0, attacker.power + enhance);
}

/**
 * The Enhance a drawn arrow of `user`'s carries when it flies: the one it
 * drew with, or one it has been given since, whichever is more.
 */
export function shotEnhance(user: Unit, shot: ShotInAir): number {
  return Math.max(shot.enhance ?? 0, user.enhance ?? 0);
}

/** Enhances `u` by `amount` until the end of its next turn, replacing any Enhance it had. */
export function enhance(ctx: Ctx, u: Unit, amount: number): void {
  u.enhance = amount;
  delete u.enhanceStarted;
  log(ctx, `${unitName(u)} is Enhanced ${amount}.`);
}

/** At the end of a unit's turn: an Enhance whose turn this was ends. */
export function endTurnEffects(unit: Unit): void {
  if (!unit.enhanceStarted) return;
  delete unit.enhance;
  delete unit.enhanceStarted;
}

/**
 * Health lost. A Bökh Champion that takes damage lets go of the unit it
 * grapples (owner, 2026-10-23).
 */
export function applyDamage(ctx: Ctx, target: Unit, amount: number, text: string): void {
  if (!target.alive || amount <= 0) return;
  target.hp = Math.max(0, target.hp - amount);
  log(ctx, `${text}.`);
  record(ctx.state, {kind: 'damage', unitId: target.id, amount});
  if (target.hp === 0) kill(ctx, target);
  else endGrapples(ctx, (g) => g.champion === target.id);
}

export function kill(ctx: Ctx, unit: Unit): void {
  const at = unit.hex;
  unit.alive = false;
  unit.slot = null;
  unit.hex = null;
  log(ctx, `${unitName(unit)} falls.`);
  if (at) record(ctx.state, {kind: 'death', unitId: unit.id, hex: at});
  endGrapples(ctx, (g) => g.champion === unit.id || g.target === unit.id, true);
  // Its hail lasted until its next turn, which won't come; its shots until its card came back.
  clearHail(ctx.state, unit);
  if (ctx.state.shots) ctx.state.shots = ctx.state.shots.filter((v) => v.source !== unit.id);
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

// ─── Hail ────────────────────────────────────────────────────────────────────

/**
 * `caster`'s hail disappears (its next turn has come, or it fell), and with
 * it the Immobilized it gave.
 */
export function clearHail(state: FightState, caster: Unit): void {
  state.effects = state.effects.filter((e) => e.source !== caster.id);
  for (const u of state.units) u.statuses = u.statuses.filter((s) => s.hail !== caster.id);
}

/**
 * `user`'s shots fly, its charging card having come back: each down its
 * lane from where the Outrider stands now, the first unit in it taking its
 * power (`shotLane`).
 */
export function landShots(ctx: Ctx, user: Unit): void {
  const mine = ctx.state.shots?.filter((v) => v.source === user.id);
  if (!mine?.length) return;
  ctx.state.shots = ctx.state.shots!.filter((v) => v.source !== user.id);
  for (const v of mine) {
    log(ctx, `${unitName(user)} looses the drawn arrow.`);
    const lane = shotLane(ctx.state, ctx.map, v);
    const end = lane[lane.length - 1] ?? user.hex!;
    record(ctx.state, {kind: 'land', unitId: user.id, ability: 'skirmish', target: end});
    const u = unitAt(ctx.state, end);
    if (u && u !== user)
      hit(ctx, user, u, `${unitName(user)}'s skirmish arrow`, shotEnhance(user, v));
  }
}

/** A unit in hail is Immobilized until that hail disappears (owner, 2026-10-23). */
export function hailHolds(ctx: Ctx, unit: Unit): void {
  if (!unit.alive || !unit.hex || !hailOn(ctx.state, unit.hex)) return;
  const hail = ctx.state.effects.find((e) => hexEquals(e.hex, unit.hex!))!;
  if (unit.statuses.some((s) => s.hail === hail.source)) return;
  addStatus(unit, {kind: 'immobilized', hail: hail.source});
  log(ctx, `Hail holds ${unitName(unit)} fast.`);
}

// ─── Grapples ────────────────────────────────────────────────────────────────

type Grapple = NonNullable<Status['grapple']>;

/**
 * Ends every grapple `ends` picks: the Stunned it gave goes. `quiet` for a
 * death, which says enough.
 */
export function endGrapples(ctx: Ctx, ends: (g: Grapple) => boolean, quiet = false): void {
  for (const u of ctx.state.units) {
    const kept = u.statuses.filter((s) => !s.grapple || !ends(s.grapple));
    if (kept.length === u.statuses.length) continue;
    u.statuses = kept;
    if (!quiet && u.alive) log(ctx, `The grapple on ${unitName(u)} is broken.`);
  }
}

/**
 * Stuns `u`. A Stunned Bökh Champion lets go of the unit it grapples
 * (owner, 2026-10-23), and a Stunned Outrider loses the arrow it has drawn
 * (owner, 2026-10-24): its card comes back as an ordinary turn, skipped
 * while it is Stunned.
 */
export function stun(ctx: Ctx, u: Unit, status: Status): void {
  addStatus(u, status);
  endGrapples(ctx, (g) => g.champion === u.id);
  if (ctx.state.shots?.some((v) => v.source === u.id)) {
    ctx.state.shots = ctx.state.shots.filter((v) => v.source !== u.id);
    log(ctx, `${unitName(u)} loses the drawn arrow.`);
  }
}

/**
 * At the start of a Champion's turn, each unit it still grapples takes
 * `ABILITY.grapple.squeeze` (owner, 2026-10-23).
 */
export function squeezeGrapples(ctx: Ctx, champion: Unit): void {
  for (const u of ctx.state.units) {
    if (!u.alive || !u.statuses.some((s) => s.grapple?.champion === champion.id)) continue;
    const amount =
      ABILITY.grapple.squeeze + (ABILITY.grapple.enhancedSqueeze ? (champion.enhance ?? 0) : 0);
    applyDamage(ctx, u, amount, `The grapple squeezes ${unitName(u)} for ${amount}`);
  }
}

/**
 * Ends the grapples `unit` holds or is held by whose two are no longer
 * next to each other.
 */
export function endGrapplesApart(ctx: Ctx, unit: Unit): void {
  endGrapples(ctx, (g) => (g.champion === unit.id || g.target === unit.id) && apart(ctx.state, g));
}

/**
 * A grapple lasts while the two stay next to each other (owner,
 * 2026-10-22): being moved away ends it, and so does a walk that ends
 * away; the Champion may walk while it grapples, round its target
 * (owner, 2026-10-23).
 */
function apart(state: FightState, g: Grapple): boolean {
  const a = state.units.find((u) => u.id === g.champion)?.hex;
  const b = state.units.find((u) => u.id === g.target)?.hex;
  return !a || !b || hexDistance(a, b) > 1;
}

// ─── Moving ──────────────────────────────────────────────────────────────────

/**
 * Moves a unit onto a space: by walking, or moved there by another unit
 * (`how`, for the page's playback). Grapples it leaves the reach of end,
 * unless it's a step partway along a walk (`midWalk`), which checks them
 * where it ends (`endGrapplesApart`); hail there holds it.
 */
export function enterHex(
  ctx: Ctx,
  unit: Unit,
  h: Hex,
  how: Motion = 'walk',
  midWalk = false
): void {
  const from = unit.hex;
  unit.hex = h;
  if (from) record(ctx.state, {kind: 'step', unitId: unit.id, from, to: h, how});
  if (!midWalk) endGrapplesApart(ctx, unit);
  hailHolds(ctx, unit);
}
