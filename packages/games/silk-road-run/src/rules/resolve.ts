/**
 * Effects every ability is built from: damage, entering a space, hail and
 * grapples ending, death and the end of the fight.
 */
import {
  hexDirectionTo,
  hexDistance,
  hexEquals,
  hexNeighbor,
  hexNeighbors,
} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITY, CAMEL, HEROES} from './config';
import {addStatus, hailOn, isImmobilized, isStunned, shotLane, unitAt, walkable} from './board';
import {MAPS} from './map';
import {hasPassive, spendPassive} from './passives';
import {placeCard, simultaneousOrder} from './track';
import type {MapData} from './map';
import type {
  BoardSnapshot,
  FightEvent,
  FightState,
  HailEffect,
  Motion,
  ShotInAir,
  Status,
  Unit,
} from './types';

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
 * 2026-10-23), plus its Empower (or `empower`, one the hit carries from
 * when it was made) and its passives' (Glass Cannon, Lone Wolf, and
 * against this target Opportunist and Flanker), less its Weaken; then
 * the target's Armour (Hardened) unless it Pierces (Piercing Eye), and an
 * ally's Bulwark (17.6's damage order; 19.8). Power 0 deals none, and
 * says nothing.
 */
export function hit(
  ctx: Ctx,
  attacker: Unit,
  target: Unit,
  what: string,
  empower = attacker.empower ?? 0
): void {
  if (!target.alive) return;
  const bonus = passiveEmpower(attacker, ctx.state) + bonusAgainst(ctx.state, attacker, target);
  const full = attacker.power + empower + bonus;
  if (attacker.weaken && full > 0) log(ctx, `Weaken takes off ${Math.min(full, attacker.weaken)}.`);
  let amount = Math.max(0, full - (attacker.weaken ?? 0));
  if (amount <= 0) return;
  if (empower) log(ctx, `Empower adds ${empower}.`);
  if (bonus) log(ctx, `Passives add ${bonus}.`);
  const pierces = hasPassive(attacker, 'piercingEye') && isImmobilized(target);
  // Hardened: Armour 1 against the first hit each fight, spent even when Pierced.
  if (spendPassive(target, 'hardened')) {
    if (pierces) log(ctx, `The hit Pierces ${unitName(target)}’s Armour.`);
    else {
      amount -= 1;
      log(ctx, `Armour takes off 1.`);
    }
  }
  if (amount <= 0) return;
  amount = bulwark(ctx, attacker, target, amount);
  if (amount <= 0) return;
  applyDamage(ctx, target, amount, `${what} hits ${unitName(target)} for ${amount}`, attacker);
}

/**
 * An ability's damage (17.6, step 1): power plus Empower and the Empower
 * of its passives (`passiveEmpower`, Lone Wolf's only with the `state`),
 * minus Weaken, at least 0. A hit's own bonuses against its target
 * (`bonusAgainst`) aren't in it.
 */
export function damageOf(
  attacker: Unit,
  empower = attacker.empower ?? 0,
  state?: FightState
): number {
  return Math.max(
    0,
    attacker.power + empower + passiveEmpower(attacker, state) - (attacker.weaken ?? 0)
  );
}

/**
 * The Empower `u`'s passives give it (19.8): Glass Cannon's always, Lone
 * Wolf's while no ally is within 2 spaces (known only with the `state`).
 */
export function passiveEmpower(u: Unit, state?: FightState): number {
  let n = hasPassive(u, 'glassCannon') ? 1 : 0;
  if (state && hasPassive(u, 'loneWolf') && u.hex) {
    const near = state.units.some(
      (a) => a !== u && a.alive && a.hex && a.side === u.side && hexDistance(a.hex, u.hex!) <= 2
    );
    if (!near) n += 1;
  }
  return n;
}

/**
 * What `attacker`'s passives add to a hit on `target` (19.8): Opportunist's
 * 1 if the target hasn't had a turn since the attacker's last one (its turn
 * before this one, if this is its turn); Flanker's 1 if an ally of the
 * attacker stands on the target's far side, along the straight line from
 * the attacker (none off a straight line).
 */
export function bonusAgainst(state: FightState, attacker: Unit, target: Unit): number {
  let n = 0;
  if (hasPassive(attacker, 'opportunist')) {
    const mine = attacker.turns ?? [];
    const acting = mine[mine.length - 1] === state.currentSlot;
    const since = acting ? mine[mine.length - 2] : mine[mine.length - 1];
    const theirs = target.turns?.[target.turns.length - 1];
    if (theirs === undefined || (since !== undefined && theirs < since)) n += 1;
  }
  if (hasPassive(attacker, 'flanker') && attacker.hex && target.hex) {
    const dir = hexDirectionTo(attacker.hex, target.hex);
    const beyond = dir === null ? undefined : unitAt(state, hexNeighbor(target.hex, dir));
    if (beyond && beyond !== attacker && beyond.side === attacker.side) n += 1;
  }
  return n;
}

/**
 * Bulwark (19.8): a hit on `target` is its first since each Bulwark ally's
 * last turn, or not; the first Bulwark ally next to it whose first it is
 * takes 1 of the damage. Returns what is left for the target.
 */
function bulwark(ctx: Ctx, attacker: Unit, target: Unit, amount: number): number {
  let guard: Unit | undefined;
  for (const g of ctx.state.units) {
    if (g === target || !g.alive || g.side !== target.side || !hasPassive(g, 'bulwark')) continue;
    if (g.covered?.includes(target.id)) continue;
    // A new list: copies of a fight share a unit's arrays.
    g.covered = [...(g.covered ?? []), target.id];
    if (!guard && g.hex && target.hex && hexDistance(g.hex, target.hex) === 1) guard = g;
  }
  if (!guard) return amount;
  log(ctx, `${unitName(guard)} takes 1 for ${unitName(target)}.`);
  applyDamage(ctx, guard, 1, `${unitName(guard)} takes 1`, attacker);
  return amount - 1;
}

/**
 * The Empower a drawn arrow of `user`'s carries when it flies: the one it
 * drew with, or one it has been given since, whichever is more.
 */
export function shotEmpower(user: Unit, shot: ShotInAir): number {
  return Math.max(shot.empower ?? 0, user.empower ?? 0);
}

/** Empowers `u` by `amount` until the end of its next turn, replacing any Empower it had. */
export function empower(ctx: Ctx, u: Unit, amount: number): void {
  u.empower = amount;
  delete u.empowerStarted;
  log(ctx, `${unitName(u)} is Empowered ${amount}.`);
}

/** Heals `u` by `amount`, up to its health (Elixir). */
export function heal(ctx: Ctx, u: Unit, amount: number): void {
  const healed = Math.min(amount, u.maxHp - u.hp);
  if (healed <= 0) return;
  u.hp += healed;
  log(ctx, `${unitName(u)} heals ${healed}.`);
  record(ctx.state, {kind: 'heal', unitId: u.id, amount: healed});
}

/** Weakens `u` by `amount` until the end of its next turn, replacing any Weaken it had. */
export function weaken(ctx: Ctx, u: Unit, amount: number): void {
  u.weaken = amount;
  delete u.weakenStarted;
  log(ctx, `${unitName(u)} is Weakened ${amount}.`);
}

/**
 * Empowers `u` by at least `amount` until the end of its next turn
 * (Vengeance, 19.8): a stronger Empower it has stays, and lasts as long.
 */
export function empowerAtLeast(ctx: Ctx, u: Unit, amount: number): void {
  u.empower = Math.max(u.empower ?? 0, amount);
  delete u.empowerStarted;
  log(ctx, `${unitName(u)} is Empowered ${u.empower}.`);
}

/** Inevitable (17.3; Steady Gait, 19.8): the card can't be Delayed or Hastened. */
function inevitable(ctx: Ctx, u: Unit): boolean {
  if (!hasPassive(u, 'steadyGait')) return false;
  log(ctx, `${unitName(u)} is Inevitable.`);
  return true;
}

/**
 * Delays `u`'s card `n` slots later (keywords.md 17.3), a taken slot
 * resolved by speed as any placement is (3.3; owner, 2026-10-26). The delay
 * limit (3.6) is not built.
 */
export function delay(ctx: Ctx, u: Unit, n: number): void {
  if (!u.alive || u.slot === null || n <= 0 || inevitable(ctx, u)) return;
  placeCard(ctx.state, u, u.slot + n);
  log(ctx, `${unitName(u)} is Delayed ${n}.`);
}

/**
 * Hastens `u`'s card `n` slots earlier (keywords.md 17.3), never earlier
 * than the next slot, a taken slot resolved by speed as any placement is
 * (3.3; owner, 2026-10-26). During its own turn (or a charging card's
 * landing), its card not yet placed, the Haste is taken off as the card is
 * placed (`Unit.hasteDue`). The haste limit is not built.
 */
export function haste(ctx: Ctx, u: Unit, n: number): void {
  if (!u.alive || u.slot === null || n <= 0 || inevitable(ctx, u)) return;
  log(ctx, `${unitName(u)} is Hastened ${n}.`);
  if (u.slot <= ctx.state.currentSlot) u.hasteDue = (u.hasteDue ?? 0) + n;
  else placeCard(ctx.state, u, Math.max(ctx.state.currentSlot + 1, u.slot - n));
}

/** Takes off the Haste `unit` was given during its turn, its card just placed (`haste`). */
export function takeHasteDue(state: FightState, unit: Unit): void {
  const n = unit.hasteDue;
  delete unit.hasteDue;
  if (!n || !unit.alive || unit.slot === null) return;
  placeCard(state, unit, Math.max(state.currentSlot + 1, unit.slot - n));
}

/**
 * At the start of `unit`'s turn, its passives' bookkeeping (19.8): the
 * turn noted (Opportunist), its Shield and Unstoppable gone (Rally's and
 * the Elixir's last until now), a
 * fresh count of its allies' first hits (Bulwark) and of what it takes off
 * the board (Momentum); then Rally Shields each ally next to it.
 */
export function startTurnPassives(ctx: Ctx, unit: Unit): void {
  unit.turns = [...(unit.turns ?? []).slice(-1), ctx.slot];
  delete unit.shield;
  delete unit.unstoppable;
  delete unit.immortal;
  // A delayed Immortal begins now, lasting until the start of its next turn.
  if (unit.immortalDue) {
    delete unit.immortalDue;
    unit.immortal = true;
    log(ctx, `${unitName(unit)} is Immortal until its next turn.`);
  }
  delete unit.covered;
  delete unit.tookOff;
  if (!hasPassive(unit, 'rally') || !unit.hex) return;
  for (const h of hexNeighbors(unit.hex)) {
    const a = unitAt(ctx.state, h);
    if (!a || a.side !== unit.side) continue;
    a.shield = Math.max(a.shield ?? 0, 1);
    log(ctx, `${unitName(unit)} rallies ${unitName(a)}: Shield ${a.shield}.`);
  }
}

/** At the end of a unit's turn: an Empower or Weaken whose turn this was ends. */
export function endTurnEffects(unit: Unit): void {
  if (unit.empowerStarted) {
    delete unit.empower;
    delete unit.empowerStarted;
  }
  if (unit.weakenStarted) {
    delete unit.weaken;
    delete unit.weakenStarted;
  }
}

/**
 * Damage taken (17.6, steps 3 and 4): its Shield takes it first, health
 * the rest. A Grappler that takes damage lets go of the unit it
 * grapples (owner, 2026-10-23); damage a Shield absorbs whole isn't taken.
 * Then the passives that answer damage (19.8): Shake Loose, Last Stand,
 * Second Wind. `source`, the unit dealing it, if any, is credited with a
 * kill (Momentum).
 */
export function applyDamage(
  ctx: Ctx,
  target: Unit,
  amount: number,
  text: string,
  source?: Unit
): void {
  if (!target.alive || amount <= 0) return;
  if (target.shield) {
    const absorbed = Math.min(target.shield, amount);
    target.shield -= absorbed;
    if (!target.shield) delete target.shield;
    amount -= absorbed;
    log(ctx, `${unitName(target)}’s Shield takes ${absorbed}.`);
    if (amount <= 0) return;
  }
  // Immortal (17.6): what reaches health becomes 0.
  if (target.immortal) {
    log(ctx, `${unitName(target)} is Immortal: no damage.`);
    return;
  }
  const stunned = isStunned(target);
  const standing = target.hp - amount <= 0 && spendPassive(target, 'lastStand');
  target.hp = standing ? 1 : Math.max(0, target.hp - amount);
  log(ctx, `${text}.`);
  record(ctx.state, {kind: 'damage', unitId: target.id, amount});
  if (target.hp === 0) {
    kill(ctx, target, source);
    return;
  }
  endGrapples(ctx, (g) => g.champion === target.id);
  if (stunned && hasPassive(target, 'shakeLoose') && isStunned(target)) {
    endGrapples(ctx, (g) => g.target === target.id, true);
    target.statuses = target.statuses.filter((s) => s.kind !== 'stunned');
    log(ctx, `${unitName(target)} shakes loose.`);
  }
  if (standing) {
    log(ctx, `${unitName(target)} makes a last stand.`);
    stun(ctx, target, {kind: 'stunned', lastStand: true});
  }
  if (target.hp * 2 <= target.maxHp && spendPassive(target, 'secondWind')) {
    log(ctx, `${unitName(target)} finds a second wind.`);
    haste(ctx, target, 2);
  }
}

/**
 * `unit` falls, `killer` (if any) having taken it off the board
 * (Momentum); each ally of its with Vengeance is Hastened 3 and Empowered
 * 1 for its next turn (19.8).
 */
export function kill(ctx: Ctx, unit: Unit, killer?: Unit): void {
  const at = unit.hex;
  unit.alive = false;
  unit.slot = null;
  unit.hex = null;
  log(ctx, `${unitName(unit)} falls.`);
  if (at) record(ctx.state, {kind: 'death', unitId: unit.id, hex: at});
  endGrapples(ctx, (g) => g.champion === unit.id || g.target === unit.id, true);
  // Its hail lasted until a turn of its, which won't come; its shots until its card came back.
  clearHail(ctx.state, unit);
  if (ctx.state.shots) ctx.state.shots = ctx.state.shots.filter((v) => v.source !== unit.id);
  if (killer) killer.tookOff = true;
  checkEnd(ctx.state);
  if (ctx.state.phase !== 'fight') return;
  for (const a of ctx.state.units) {
    if (!a.alive || a.side !== unit.side || !hasPassive(a, 'vengeance')) continue;
    log(ctx, `${unitName(a)} swears vengeance.`);
    haste(ctx, a, 3);
    empowerAtLeast(ctx, a, 1);
  }
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
 * `caster`'s hail disappears (it fell, or casts it again), and with it the
 * Immobilized it gave.
 */
/** When hail with `turns` of its caster's turns to go lifts, for the rule text: `whose` turn. */
export function hailEnds(turns: number, whose: string): string {
  if (turns <= 1) return `${whose} next turn`;
  if (turns === 2) return `${whose} turn after next`;
  return `${whose} turn ${turns} turns from now`;
}

/**
 * `caster`'s turn starts: its hail has a turn fewer to stand, and lifts if
 * this was its last.
 */
export function ageHail(state: FightState, caster: Unit): void {
  for (const hail of state.effects.filter((e) => e.source === caster.id)) {
    hail.turns = (hail.turns ?? 1) - 1;
    if (hail.turns <= 0) liftHail(state, hail);
  }
}

/** One hail lifts, freeing whoever it held (`ABILITY.hail.max` lets a caster have more than one). */
export function liftHail(state: FightState, hail: HailEffect): void {
  state.effects = state.effects.filter((e) => e !== hail);
  for (const u of state.units)
    u.statuses = u.statuses.filter(
      (s) => s.hail !== hail.source || (s.at !== undefined && !hexEquals(s.at, hail.hex))
    );
}

/** `unit` is made Unstoppable: the hail holding it lets go (keywords.md, 17.4). */
export function makeUnstoppable(ctx: Ctx, unit: Unit): void {
  unit.unstoppable = true;
  unit.statuses = unit.statuses.filter((s) => !(s.kind === 'immobilized' && s.hail));
  log(ctx, `${unitName(unit)} is Unstoppable until its next turn.`);
}

/**
 * An Elixir's swap (`ABILITY.elixir.swap`, a switch for measuring): `unit`'s
 * speed becomes its health and its health its speed, until `unswap`.
 */
export function swapSpeedHealth(ctx: Ctx, unit: Unit): void {
  unit.swapped = {speed: unit.speed, hp: unit.hp};
  [unit.speed, unit.hp] = [unit.hp, unit.speed];
  log(ctx, `${unitName(unit)} swaps its speed and health: speed ${unit.speed}, health ${unit.hp}.`);
}

/**
 * Its speed and health back from a swap: its own speed, and its own health
 * (`pool`) or that less what it lost while swapped, or more what it gained
 * (`carry`, falling if none is left), up to its health.
 */
export function unswap(ctx: Ctx, unit: Unit): void {
  const was = unit.swapped;
  if (!was) return;
  delete unit.swapped;
  if (!unit.alive) return;
  const hp = ABILITY.elixir.swap === 'carry' ? was.hp + unit.hp - was.speed : was.hp;
  unit.speed = was.speed;
  unit.hp = Math.min(unit.maxHp, Math.max(0, hp));
  log(
    ctx,
    `${unitName(unit)}’s speed and health swap back: speed ${unit.speed}, health ${unit.hp}.`
  );
  if (unit.hp === 0) kill(ctx, unit);
}

/** The health `unit` will have once a swap ends (`unswap`); its health when not swapped. */
export function healthAfterSwap(unit: Unit): number {
  const was = unit.swapped;
  if (!was || !unit.alive) return unit.hp;
  const hp = ABILITY.elixir.swap === 'carry' ? was.hp + unit.hp - was.speed : was.hp;
  return Math.min(unit.maxHp, Math.max(0, hp));
}

/**
 * `unit` is made Immortal until the start of its next turn (keywords.md,
 * 17.6), or with `ABILITY.elixir.immortalWhen` `delayed` from then until the
 * start of the turn after (`startTurnPassives`).
 */
export function makeImmortal(ctx: Ctx, unit: Unit): void {
  if (ABILITY.elixir.immortalWhen === 'delayed') {
    unit.immortalDue = true;
    log(ctx, `${unitName(unit)} will be Immortal from its next turn.`);
    return;
  }
  unit.immortal = true;
  log(ctx, `${unitName(unit)} is Immortal until its next turn.`);
}

export function clearHail(state: FightState, caster: Unit): void {
  state.effects = state.effects.filter((e) => e.source !== caster.id);
  for (const u of state.units) u.statuses = u.statuses.filter((s) => s.hail !== caster.id);
}

/**
 * `user`'s shots fly, its charging card having come back: each down its
 * lane from where the Horse Archer stands now, the first unit in it taking its
 * power (`shotLane`).
 */
export function landShots(ctx: Ctx, user: Unit): void {
  const mine = ctx.state.shots?.filter((v) => v.source === user.id);
  if (!mine?.length) return;
  ctx.state.shots = ctx.state.shots!.filter((v) => v.source !== user.id);
  for (const v of mine) {
    if (v.hex) {
      // A Volley: arrows from above on its space.
      log(ctx, `${unitName(user)}'s volley lands.`);
      record(ctx.state, {kind: 'land', unitId: user.id, ability: 'volley', target: v.hex});
      const u = unitAt(ctx.state, v.hex);
      if (u && u !== user) hit(ctx, user, u, `${unitName(user)}'s volley`, shotEmpower(user, v));
      continue;
    }
    log(ctx, `${unitName(user)} looses the drawn arrow.`);
    const lane = shotLane(ctx.state, ctx.map, v);
    const end = lane[lane.length - 1] ?? user.hex!;
    record(ctx.state, {kind: 'land', unitId: user.id, ability: 'skirmish', target: end});
    const u = unitAt(ctx.state, end);
    if (u && u !== user)
      hit(ctx, user, u, `${unitName(user)}'s skirmish arrow`, shotEmpower(user, v));
  }
}

/**
 * A unit in hail is Immobilized until that hail disappears (owner,
 * 2026-10-23); not while Unstoppable.
 */
export function hailHolds(ctx: Ctx, unit: Unit): void {
  if (!unit.alive || !unit.hex || unit.unstoppable || !hailOn(ctx.state, unit.hex)) return;
  const hail = ctx.state.effects.find((e) => hexEquals(e.hex, unit.hex!))!;
  if (unit.statuses.some((s) => s.hail === hail.source && (!s.at || hexEquals(s.at, hail.hex))))
    return;
  addStatus(unit, {
    kind: 'immobilized',
    hail: hail.source,
    ...(ABILITY.hail.max > 1 ? {at: {...hail.hex}} : {}),
  });
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
 * Stuns `u`, unless Iron Will turns it (19.8). A Stunned Grappler lets go of the unit it grapples
 * (owner, 2026-10-23), and a Stunned Horse Archer loses the arrow it has drawn
 * (owner, 2026-10-24): its card comes back as an ordinary turn, skipped
 * while it is Stunned.
 */
export function stun(ctx: Ctx, u: Unit, status: Status): void {
  // Iron Will (19.8): the first Stun each fight doesn't take.
  if (spendPassive(u, 'ironWill')) {
    log(ctx, `${unitName(u)}’s iron will holds: not Stunned.`);
    return;
  }
  addStatus(u, status);
  endGrapples(ctx, (g) => g.champion === u.id);
  if (ctx.state.shots?.some((v) => v.source === u.id)) {
    ctx.state.shots = ctx.state.shots.filter((v) => v.source !== u.id);
    log(ctx, `${unitName(u)} loses the drawn arrow.`);
  }
}

/**
 * At the start of a Grappler's turn, each unit it still grapples takes
 * `ABILITY.grapple.squeeze` (owner, 2026-10-23).
 */
export function squeezeGrapples(ctx: Ctx, champion: Unit): void {
  for (const u of ctx.state.units) {
    if (!u.alive || !u.statuses.some((s) => s.grapple?.champion === champion.id)) continue;
    const empowered = (champion.empower ?? 0) + passiveEmpower(champion, ctx.state);
    const amount = Math.max(
      0,
      ABILITY.grapple.squeeze +
        (ABILITY.grapple.empoweredSqueeze ? empowered : 0) -
        (champion.weaken ?? 0)
    );
    applyDamage(ctx, u, amount, `The grapple squeezes ${unitName(u)} for ${amount}`, champion);
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
 * away; the Grappler may walk while it grapples, round its target
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
  if (ABILITY.hail.entry && hailOn(ctx.state, h)) {
    // `ABILITY.hail.entry` (owner, 2026-10-26): entering hail hurts, its caster's power.
    const source = ctx.state.effects.find((e) => hexEquals(e.hex, h))!.source;
    const caster = ctx.state.units.find((u) => u.id === source);
    if (caster) hit(ctx, caster, unit, 'The hail', 0);
  }
  hailHolds(ctx, unit);
}

/**
 * Displaces `unit` up to `n` spaces along hex direction `dir` (Push and
 * Pull, keywords.md, 17.4): it stops early at a yurt, another unit or the
 * map's edge, with no collision damage (open question 55). Each space
 * entered triggers as a walk's does. A Rooted (19.8) or Unstoppable unit
 * isn't moved; one that is, with Rebound, Pushes its new neighbours
 * (`displaced`).
 */
export function displace(ctx: Ctx, unit: Unit, dir: number, n: number, how: Motion): void {
  if (hasPassive(unit, 'rooted')) {
    log(ctx, `${unitName(unit)} is Rooted.`);
    return;
  }
  if (unit.unstoppable) {
    log(ctx, `${unitName(unit)} is Unstoppable.`);
    return;
  }
  const from = unit.hex;
  for (let i = 0; i < n && unit.alive && unit.hex; i++) {
    const next = hexNeighbor(unit.hex, dir);
    if (!walkable(ctx.map, next) || unitAt(ctx.state, next)) break;
    enterHex(ctx, unit, next, how, true);
  }
  if (!unit.alive) return;
  endGrapplesApart(ctx, unit);
  if (from && unit.hex && !hexEquals(from, unit.hex)) displaced(ctx, unit);
}

/** How deep Rebounds set off by Rebounds go: a safety bound, as each must move a unit. */
const MAX_REBOUNDS = 12;
let rebounds = 0;

/**
 * `unit` has been Pushed, Pulled or Moved onto a new space, by an ally or
 * an enemy: with Rebound (19.8), each unit next to it there, allies
 * included, is Pushed 1 away from it, one at a time in the order for cards
 * placed at the same moment (17.4, 3.3).
 */
export function displaced(ctx: Ctx, unit: Unit): void {
  if (!hasPassive(unit, 'rebound') || !unit.alive || !unit.hex || rebounds >= MAX_REBOUNDS) return;
  const around = hexNeighbors(unit.hex)
    .map((h) => unitAt(ctx.state, h))
    .filter((u): u is Unit => u !== undefined && u !== unit);
  if (around.length === 0) return;
  log(ctx, `${unitName(unit)} rebounds.`);
  rebounds++;
  try {
    for (const u of simultaneousOrder(around)) {
      if (!u.alive || !u.hex || !unit.hex || hexDistance(u.hex, unit.hex) !== 1) continue;
      displace(ctx, u, hexDirectionTo(unit.hex, u.hex)!, 1, 'push');
    }
  } finally {
    rebounds--;
  }
}

/**
 * `unit` walks `path` (its start left out). With Light Step (19.8) the walk
 * may pass allies, and end on one: the two swap places, the ally Moved to
 * the space the walk came from (`reachableHexes`).
 */
export function walk(ctx: Ctx, unit: Unit, path: Hex[]): void {
  if (path.length === 0 || !unit.hex) return;
  const end = path[path.length - 1]!;
  const back = path.length > 1 ? path[path.length - 2]! : unit.hex;
  const ally = ctx.state.units.find((u) => u !== unit && u.alive && u.hex && hexEquals(u.hex, end));
  path.forEach((h, i) => enterHex(ctx, unit, h, 'walk', i < path.length - 1 || ally !== undefined));
  if (!ally) return;
  log(ctx, `${unitName(unit)} swaps places with ${unitName(ally)}.`);
  enterHex(ctx, ally, back, 'swap');
  endGrapplesApart(ctx, unit);
  displaced(ctx, ally);
}
