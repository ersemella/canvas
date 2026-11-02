/**
 * Effects every ability is built from: damage, entering a space, hail and
 * grapples ending, death and the end of the fight.
 */
import {hexDirectionTo, hexDistance, hexEquals, hexNeighbor} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {
  ABILITY,
  ARMOURED,
  BATTLE_CRY,
  BLOODLUST,
  FURY,
  CAMEL,
  DEVOTED,
  HEROES,
  PASSIVE,
  RULES,
  SPEARHEAD,
  UPGRADE,
} from './config';
import {
  addStatus,
  exitSealed,
  fireOn,
  hailOn,
  hostile,
  isUnstoppable,
  shotLane,
  sortByHex,
  unitAt,
  walkable,
} from './board';
import {scorched} from './map';
import {hasPassive, spendPassive} from './passives';
import {aimSlot, placeCard} from './track';
import type {MapData} from './map';
import type {
  BoardSnapshot,
  FightEvent,
  FightState,
  HailEffect,
  Motion,
  PassiveId,
  ShotInAir,
  Status,
  Unit,
} from './types';

export interface Ctx {
  state: FightState;
  map: MapData;
  /** The slot the turn happens on. */
  slot: number;
  /** The unit whose ability (or landing shot) this is, if any. */
  user?: Unit;
  /** That ability Pushes of its own, so Forceful adds none (19.9). */
  pushes?: boolean;
  /**
   * The generic upgrades (19.9) that have fired during this ability, each
   * with the unit it fired on: each fires at most once a unit, so none
   * loops (Empowering with Hastening).
   */
  fired?: Set<string>;
  /** Pushes from Forceful, made once the ability has resolved (`settle`). */
  pending?: (() => void)[];
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
    ...(state.fires?.length ? {fires: state.fires.map((f) => ({...f, hex: {...f.hex}}))} : {}),
    ...(state.fan ? {fan: {...state.fan}} : {}),
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
 * the target's Armour (Armoured, Plated) unless it Pierces
 * (17.6's damage order; 19.8). Power 0 deals none, and says nothing. With
 * Sure Hand (19.8) an ally takes none.
 */
export function hit(
  ctx: Ctx,
  attacker: Unit,
  target: Unit,
  what: string,
  empower = attacker.empower ?? 0,
  pierce = false
): void {
  if (!target.alive) return;
  if (spares(ctx, attacker, target)) return reach(ctx, attacker, target);
  const bonus = passiveEmpower(attacker, ctx.state) + bonusAgainst(ctx.state, attacker, target);
  const full = attacker.power + empower + bonus;
  if (attacker.weaken && full > 0) log(ctx, `Weaken takes off ${Math.min(full, attacker.weaken)}.`);
  const amount = Math.max(0, full - (attacker.weaken ?? 0));
  if (amount <= 0) return;
  if (empower) log(ctx, `Empower adds ${empower}.`);
  if (bonus) log(ctx, `Passives add ${bonus}.`);
  hitFor(ctx, attacker, target, what, amount, pierce);
}

/**
 * A hit of `amount` already reckoned (a track Blessing's share of the
 * Priest's power): Armour as `hit`'s, an attack's riders, and what the
 * attacker's abilities give each unit they reach (`reach`).
 */
export function hitFor(
  ctx: Ctx,
  attacker: Unit,
  target: Unit,
  what: string,
  amount: number,
  pierce = false
): void {
  if (!target.alive || amount <= 0) return;
  if (spares(ctx, attacker, target)) return reach(ctx, attacker, target);
  const pierces = pierce || (hasPassive(attacker, 'sundering') && hostile(attacker, target));
  land(ctx, attacker, target, what, amount, pierces);
  // An attack (19.9): an ability that damages an enemy, Armour or a Shield taking it or not.
  if (hostile(attacker, target)) attackRiders(ctx, attacker, target);
  reach(ctx, attacker, target);
}

/**
 * Sure Hand (19.8; owner, 2026-11-02): `attacker`'s abilities don't damage
 * `target`, an ally; what they give it (`reach`) it still gets.
 */
function spares(ctx: Ctx, attacker: Unit, target: Unit): boolean {
  if (!allyOf(attacker, target) || !hasPassive(attacker, 'sureHand')) return false;
  log(ctx, `${unitName(attacker)}’s sure hand spares ${unitName(target)}.`);
  return true;
}

/** A hit's `amount` after Armour (`hit`), taken by `target`. */
function land(
  ctx: Ctx,
  attacker: Unit,
  target: Unit,
  what: string,
  amount: number,
  pierces: boolean
): void {
  amount -= armourOf(ctx, target, attacker.hex, pierces);
  if (amount <= 0) return;
  applyDamage(ctx, target, amount, `${what} hits ${unitName(target)} for ${amount}`, attacker);
}

// ─── Generic ability upgrades (19.9) ─────────────────────────────────────────

/**
 * Whether `by` carries the generic upgrade `id` and it hasn't fired on `u`
 * yet during this ability, marking it fired if so: an upgrade can set off
 * another, each at most once a unit (owner, 2026-10-29).
 */
function fires(ctx: Ctx, by: Unit | undefined, id: PassiveId, u: Unit): boolean {
  if (!by || !hasPassive(by, id) || !u.alive) return false;
  const key = `${id}:${u.id}`;
  ctx.fired ??= new Set();
  if (ctx.fired.has(key)) return false;
  ctx.fired.add(key);
  return true;
}

/** Whether `u` is an ally of `by`'s, not `by` itself (19.9's "an ally"). */
const allyOf = (by: Unit | undefined, u: Unit): by is Unit =>
  by !== undefined && by !== u && !hostile(by, u);

/**
 * What `attacker`'s upgrades do to `target`, an enemy its attack has just
 * hit (19.9): Concussive's Delay (the highest of I, II and III it carries)
 * and Crippling's Weaken at once; Forceful's Push once the ability has
 * resolved (`settle`), so the ability's own effects land where it aimed
 * them. Each only if its keyword takes (`delay`).
 */
function attackRiders(ctx: Ctx, attacker: Unit, target: Unit): void {
  if (!target.alive || !target.hex || !attacker.hex) return;
  const tiers = (['concussive3', 'concussive2', 'concussive1'] as const).filter((id) =>
    hasPassive(attacker, id)
  );
  if (tiers.length > 0 && fires(ctx, attacker, tiers[0]!, target))
    delay(ctx, target, UPGRADE[tiers[0]!].delay, attacker);
  if (fires(ctx, attacker, 'crippling', target))
    weaken(ctx, target, Math.max(target.weaken ?? 0, UPGRADE.crippling.weaken), attacker);
  const push = hasPassive(attacker, 'forceful') && !(ctx.pushes && ctx.user === attacker);
  if (push && fires(ctx, attacker, 'forceful', target))
    (ctx.pending ??= []).push(() => {
      if (!target.alive || !target.hex || !attacker.alive || !attacker.hex) return;
      if (hexEquals(target.hex, attacker.hex)) return;
      log(ctx, `${unitName(target)} is Pushed by the blow.`);
      displace(ctx, target, awayFrom(attacker.hex, target.hex), UPGRADE.forceful.push, 'push');
    });
}

/**
 * What `by`'s abilities give each unit they hit or affect but itself,
 * enemy or ally (owner, 2026-11-02): Empowering's Empower, Hastening's
 * Haste and Sheltering's Shield, each once a unit an ability.
 */
function reach(ctx: Ctx, by: Unit | undefined, u: Unit): void {
  if (!by || by === u || !u.alive) return;
  if (fires(ctx, by, 'empowering', u)) empowerAtLeast(ctx, u, UPGRADE.empowering.empower);
  if (fires(ctx, by, 'hastening', u)) haste(ctx, u, UPGRADE.hastening.haste);
  if (fires(ctx, by, 'sheltering', u)) shield(ctx, u, UPGRADE.sheltering.shield);
}

/**
 * The hex direction from `to` that leads farthest from `from` (a Push from
 * `from`: straight away along a line, else the nearest way to it), or with
 * `toward`, the direction from `from` nearest toward `to` (a Pull).
 */
function awayFrom(from: Hex, to: Hex, toward = false): number {
  const exact = hexDirectionTo(from, to);
  if (exact !== null) return exact;
  const at = toward ? from : to;
  const score = (d: number) => {
    const n = hexDistance(toward ? to : from, hexNeighbor(at, d));
    return toward ? -n : n;
  };
  return [0, 1, 2, 3, 4, 5].reduce((best, d) => (score(d) > score(best) ? d : best));
}

/** Makes the Pushes and Pulls `attackRiders` left for once the ability has resolved. */
export function settle(ctx: Ctx): void {
  const pending = ctx.pending;
  delete ctx.pending;
  for (const go of pending ?? []) {
    if (ctx.state.phase !== 'fight') return;
    go();
  }
}

/**
 * Immobilizes `u` with `status` (keywords.md, 17.4), unless it is
 * Unstoppable.
 */
export function immobilize(ctx: Ctx, u: Unit, status: Status, by?: Unit): boolean {
  if (!u.alive) return false;
  if (isUnstoppable(u)) {
    log(ctx, `${unitName(u)} is Unstoppable: not Immobilized.`);
    return false;
  }
  addStatus(u, status.pinned ? {...status, until: lastsThrough(ctx.state)} : status);
  if (status.pinned) log(ctx, `${unitName(u)} is Immobilized.`);
  reach(ctx, by, u);
  return true;
}

/**
 * The lasting Armour `target` has against a hit from a unit on `from`
 * (17.6), none if it Pierces: an Armour status (a Charge's), Armoured's (the Cataphract's) and Plated's, said in the log
 * when there is a `ctx`.
 */
export function armourOf(
  ctx: Ctx | undefined,
  target: Unit,
  from: Hex | null,
  pierces = false
): number {
  let armour = 0;
  // An Armour status, for its slots.
  if (target.armour) {
    if (pierces) {
      if (ctx) log(ctx, `The hit Pierces ${unitName(target)}’s Armour.`);
    } else {
      armour += target.armour;
      if (ctx) log(ctx, `${unitName(target)}’s Armour takes off ${target.armour}.`);
    }
  }
  if (hasPassive(target, 'armoured')) {
    if (pierces) {
      if (ctx) log(ctx, `The hit Pierces ${unitName(target)}’s Armour.`);
    } else {
      armour += ARMOURED.armour;
      if (ctx) log(ctx, `${unitName(target)}’s Armour takes off ${ARMOURED.armour}.`);
    }
  }
  // Plated (19.8; owner, 2026-11-02).
  if (hasPassive(target, 'plated')) {
    if (pierces) {
      if (ctx) log(ctx, `The hit Pierces ${unitName(target)}’s plate.`);
    } else {
      armour += PASSIVE.plated.armour;
      if (ctx) log(ctx, `${unitName(target)}’s plate takes off ${PASSIVE.plated.armour}.`);
    }
  }
  return armour;
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
 * 1 if the target's card is behind the attacker's next card (where it
 * lies, or lands this turn), or off the track (owner, 2026-10-29; until
 * then, if the target hadn't had a turn since the attacker's last); Flanker's 1 if an ally of the
 * attacker stands on the target's far side, along the straight line from
 * the attacker (none off a straight line).
 */
export function bonusAgainst(state: FightState, attacker: Unit, target: Unit): number {
  let n = 0;
  if (hasPassive(attacker, 'opportunist')) {
    const next =
      attacker.slot === null
        ? null
        : attacker.slot <= state.currentSlot
          ? aimSlot(state, attacker)
          : attacker.slot;
    if (target.slot === null || (next !== null && target.slot > next)) n += 1;
  }
  if (hasPassive(attacker, 'flanker') && attacker.hex && target.hex) {
    const dir = hexDirectionTo(attacker.hex, target.hex);
    const beyond = dir === null ? undefined : unitAt(state, hexNeighbor(target.hex, dir));
    if (beyond && beyond !== attacker && beyond.side === attacker.side) n += 1;
  }
  return n;
}

/**
 * The Empower a drawn arrow of `user`'s carries when it flies: the one it
 * drew with, or one it has been given since, whichever is more.
 */
export function shotEmpower(user: Unit, shot: ShotInAir): number {
  return Math.max(shot.empower ?? 0, user.empower ?? 0);
}

/**
 * Bloodlust (`BLOODLUST`): `u`, carrying it, has damaged an enemy, so is
 * Empowered for Bloodlust's slots: at least its Empower, or that much more
 * up to its most when it stacks.
 */
function bloodlust(ctx: Ctx, u: Unit): void {
  if (!u.alive || !hasPassive(u, 'bloodlust')) return;
  const {empower: step, slots, stacks, max} = BLOODLUST;
  const amount = stacks ? Math.min(max, (u.empower ?? 0) + step) : Math.max(u.empower ?? 0, step);
  u.empower = amount;
  u.empowerUntil = Math.max(u.empowerUntil ?? 0, lastsThrough(ctx.state, slots));
  log(ctx, `${unitName(u)}’s bloodlust rises: Empowered ${amount}.`);
}

/**
 * Empowers `u` by `amount` for `RULES.durations.turn` slots, replacing any
 * Empower it had; by `by`'s ability, what its abilities give (`reach`).
 */
export function empower(ctx: Ctx, u: Unit, amount: number, by?: Unit): void {
  u.empower = amount;
  u.empowerUntil = lastsThrough(ctx.state);
  log(ctx, `${unitName(u)} is Empowered ${amount}.`);
  empowered(ctx, u, by);
}

/** What `by`'s abilities give a unit they Empower (`reach`). */
function empowered(ctx: Ctx, u: Unit, by?: Unit): void {
  reach(ctx, by, u);
}

/**
 * Heals `u` by `amount`, up to its health (Elixir). A heal by `by`'s
 * ability sets off what its abilities give (`reach`), whatever it restores.
 */
export function heal(ctx: Ctx, u: Unit, amount: number, by?: Unit): void {
  const healed = Math.min(amount, u.maxHp - u.hp);
  if (healed > 0) {
    u.hp += healed;
    log(ctx, `${unitName(u)} heals ${healed}.`);
    record(ctx.state, {kind: 'heal', unitId: u.id, amount: healed});
  }
  reach(ctx, by, u);
}

/**
 * Shields `u` by `amount` more (keywords.md, 17.6; the Priest's Blessing),
 * added to any Shield it has, for `slots` (`RULES.durations.turn`) slots
 * (a lasting one until spent).
 */
export function shield(
  ctx: Ctx,
  u: Unit,
  amount: number,
  lasting = false,
  slots: number = RULES.durations.turn
): void {
  if (!u.alive || amount <= 0) return;
  u.shield = (u.shield ?? 0) + amount;
  u.shieldUntil = Math.max(u.shieldUntil ?? 0, lastsThrough(ctx.state, slots));
  if (lasting) u.lastingShield = (u.lastingShield ?? 0) + amount;
  log(ctx, `${unitName(u)} gains Shield ${amount}: Shield ${u.shield}.`);
}

/**
 * Weakens `u` by `amount` for `RULES.durations.turn` slots, replacing any
 * Weaken it had; by `by`'s ability, what its abilities give (`reach`).
 */
export function weaken(ctx: Ctx, u: Unit, amount: number, by?: Unit): void {
  u.weaken = amount;
  u.weakenUntil = lastsThrough(ctx.state);
  log(ctx, `${unitName(u)} is Weakened ${amount}.`);
  reach(ctx, by, u);
}

/**
 * Empowers `u` by at least `amount` for `RULES.durations.turn` slots
 * (Empowering, 19.9): a stronger Empower it has stays, and
 * lasts as long.
 */
export function empowerAtLeast(ctx: Ctx, u: Unit, amount: number, by?: Unit): void {
  if ((u.empower ?? 0) <= amount) u.empowerUntil = lastsThrough(ctx.state);
  u.empower = Math.max(u.empower ?? 0, amount);
  log(ctx, `${unitName(u)} is Empowered ${u.empower}.`);
  empowered(ctx, u, by);
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
export function delay(ctx: Ctx, u: Unit, n: number, by?: Unit): void {
  if (!u.alive || u.slot === null || n <= 0 || inevitable(ctx, u)) return;
  placeCard(ctx.state, u, u.slot + n);
  log(ctx, `${unitName(u)} is Delayed ${n}.`);
  reach(ctx, by, u);
}

/**
 * Hastens `u`'s card `n` slots earlier (keywords.md 17.3), never earlier
 * than the next slot, a taken slot resolved by speed as any placement is
 * (3.3; owner, 2026-10-26). During its own turn (or a charging card's
 * landing), its card not yet placed, the Haste is taken off as the card is
 * placed (`Unit.hasteDue`). The haste limit is not built.
 */
export function haste(ctx: Ctx, u: Unit, n: number, by?: Unit): void {
  if (!u.alive || u.slot === null || n <= 0 || inevitable(ctx, u)) return;
  log(ctx, `${unitName(u)} is Hastened ${n}.`);
  if (u.slot <= ctx.state.currentSlot) u.hasteDue = (u.hasteDue ?? 0) + n;
  else placeCard(ctx.state, u, Math.max(ctx.state.currentSlot + 1, u.slot - n));
  reach(ctx, by, u);
}

/**
 * Swaps two cards' places on the track (the Magus's Omen as `swap`): each
 * takes the slot the other leaves, so nothing collides. The later one is
 * Hastened and the earlier Delayed by the same gap, neither if either is
 * Inevitable (17.3).
 */
export function swapCards(ctx: Ctx, a: Unit, b: Unit): void {
  if (!a.alive || !b.alive || a.slot === null || b.slot === null) return;
  if (inevitable(ctx, a) || inevitable(ctx, b)) return;
  [a.slot, b.slot] = [b.slot, a.slot];
  log(ctx, `${unitName(a)} and ${unitName(b)} swap places on the track.`);
}

/**
 * Puts `u`'s card on `slot` exactly, a card already there moved on (the
 * Magus's Omen as `bracket`), unless `u` is Inevitable (17.3).
 */
export function setCard(ctx: Ctx, u: Unit, slot: number): void {
  if (!u.alive || u.slot === null || inevitable(ctx, u)) return;
  placeCard(ctx.state, u, slot, true);
}

/** Takes off the Haste `unit` was given during its turn, its card just placed (`haste`). */
export function takeHasteDue(state: FightState, unit: Unit): void {
  const n = unit.hasteDue;
  delete unit.hasteDue;
  if (!n || !unit.alive || unit.slot === null) return;
  placeCard(state, unit, Math.max(state.currentSlot + 1, unit.slot - n));
}

/**
 * At the start of `unit`'s turn, its passives' bookkeeping (19.8): a fresh
 * count of what it takes off the board (Momentum).
 */
export function startTurnPassives(_ctx: Ctx, unit: Unit): void {
  delete unit.tookOff;
  delete unit.bracketed;
}

/**
 * Damage taken (17.6, steps 3 and 4): its Shield takes it first, health
 * the rest. A Grappler that takes damage lets go of the unit it
 * grapples (owner, 2026-10-23); damage a Shield absorbs whole isn't taken.
 * Then the passives that answer damage (19.8): Last Stand, Second Wind. `source`, the unit dealing it, if any, is credited with a
 * kill (Momentum). Any damage coming at a Devoted unit, whatever takes it,
 * Hastens its partner first (`devotion`), and at a Spearhead its allies
 * within its range (`spearhead`).
 */
export function applyDamage(
  ctx: Ctx,
  target: Unit,
  amount: number,
  text: string,
  source?: Unit
): void {
  if (!target.alive || amount <= 0) return;
  devotion(ctx, target);
  spearhead(ctx, target);
  battleCry(ctx, target);
  if (hasPassive(target, 'fury')) {
    log(ctx, `${unitName(target)}’s fury rises.`);
    haste(ctx, target, FURY.haste);
  }
  if (source && hostile(source, target)) bloodlust(ctx, source);
  if (target.shield) {
    const absorbed = Math.min(target.shield, amount);
    target.shield -= absorbed;
    if (!target.shield) delete target.shield;
    // What goes, goes from the part that would end at its next turn first.
    if (target.lastingShield && target.lastingShield > (target.shield ?? 0)) {
      if (target.shield) target.lastingShield = target.shield;
      else delete target.lastingShield;
    }
    amount -= absorbed;
    log(ctx, `${unitName(target)}’s Shield takes ${absorbed}.`);
    if (amount <= 0) return;
  }
  // The Serpent King: so too while a serpent of his is on the board.
  if (guarded(ctx.state, target)) {
    log(ctx, `${unitName(target)}’s serpents guard him: no damage.`);
    return;
  }
  const standing = target.hp - amount <= 0 && spendPassive(target, 'lastStand');
  target.hp = standing ? 1 : Math.max(0, target.hp - amount);
  target.damaged = true;
  log(ctx, `${text}.`);
  record(ctx.state, {kind: 'damage', unitId: target.id, amount});
  if (target.hp === 0) {
    kill(ctx, target, source);
    return;
  }
  endGrapples(ctx, (g) => g.champion === target.id);
  if (standing) {
    log(ctx, `${unitName(target)} makes a last stand.`);
    stunForATurn(ctx, target);
  }
  if (target.hp * 2 <= target.maxHp && spendPassive(target, 'secondWind')) {
    log(ctx, `${unitName(target)} finds a second wind.`);
    haste(ctx, target, PASSIVE.secondWind.haste);
  }
}

/**
 * The Serpent King (2026-10-29), Zahhak's: whether `target` carries it and
 * a serpent of its side (Regrow) is on the board, so no damage reaches its
 * health.
 */
export function guarded(state: FightState, target: Unit): boolean {
  return (
    hasPassive(target, 'serpentKing') &&
    state.units.some((u) => u.alive && u.side === target.side && hasPassive(u, 'regrow'))
  );
}

/**
 * Devoted (owner, 2026-10-28; `DEVOTED`): `target` is hit, so each other
 * Devoted unit of its side still standing, its partner, is Hastened.
 */
function devotion(ctx: Ctx, target: Unit): void {
  if (!hasPassive(target, 'devoted')) return;
  for (const u of ctx.state.units) {
    if (u === target || !u.alive || u.side !== target.side || !hasPassive(u, 'devoted')) continue;
    log(ctx, `${unitName(u)} rushes to ${unitName(target)}’s side.`);
    haste(ctx, u, DEVOTED.haste);
  }
}

/**
 * Spearhead (2026-10-30; `SPEARHEAD`): `target` is hit, so each ally
 * within `range` of it is Hastened.
 */
function spearhead(ctx: Ctx, target: Unit): void {
  if (!hasPassive(target, 'spearhead') || !target.hex) return;
  for (const a of ctx.state.units) {
    if (a === target || !a.alive || !a.hex || a.side !== target.side) continue;
    if (hexDistance(a.hex, target.hex) > SPEARHEAD.range) continue;
    log(ctx, `${unitName(target)} leads ${unitName(a)} on.`);
    haste(ctx, a, SPEARHEAD.haste);
  }
}

/**
 * Battle Cry (`BATTLE_CRY`): `target` is hit, so its own card is Hastened,
 * and each ally's within `range` of it.
 */
function battleCry(ctx: Ctx, target: Unit): void {
  if (!target.alive || !hasPassive(target, 'battleCry') || !target.hex) return;
  log(ctx, `${unitName(target)} roars.`);
  haste(ctx, target, BATTLE_CRY.self);
  for (const a of ctx.state.units) {
    if (a === target || !a.alive || !a.hex || a.side !== target.side) continue;
    if (hexDistance(a.hex, target.hex) > BATTLE_CRY.range) continue;
    haste(ctx, a, BATTLE_CRY.allies);
  }
}

/**
 * `unit` falls, `killer` (if any) having taken it off the board
 * (Momentum). Princess Iron Fan drops her fan where she fell
 * (`FightState.fan`), and the fires she set burn on: her next turn, when
 * they would go out, won't come.
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
  if (at && unit.hero === 'fanLady' && !ctx.state.fan) {
    ctx.state.fan = {...at};
    log(ctx, `${unitName(unit)} drops the Iron Fan.`);
  }
  if (ctx.state.shots) ctx.state.shots = ctx.state.shots.filter((v) => v.source !== unit.id);
  if (killer) killer.tookOff = true;
  checkEnd(ctx.state);
}

export function checkEnd(state: FightState): void {
  if (state.phase !== 'fight') return;
  const camel = camelOf(state);
  // The camel's death counts first: one action that also beats the last
  // enemy, or carries the camel onto an exit as it dies, is a loss.
  if (camel && !camel.alive) state.phase = 'lost';
  else if (!state.units.some((u) => u.alive && u.side === 'enemy')) state.phase = 'won';
  // A sealed exit (a boss standing) wins nothing: Moved onto it, it waits for the boss to fall.
  else if (camel?.hex && atExit(state, camel.hex) && !exitSealed(state)) {
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
  return state.route.exits.some((e) => hexEquals(e, h));
}

// ─── Hail ────────────────────────────────────────────────────────────────────

/**
 * `caster`'s hail disappears (it fell, or casts it again), and with it the
 * Immobilized it gave.
 */
/** One hail lifts, freeing whoever it held (`ABILITY.hail.max` lets a caster have more than one). */
export function liftHail(state: FightState, hail: HailEffect): void {
  state.effects = state.effects.filter((e) => e !== hail);
  for (const u of state.units)
    u.statuses = u.statuses.filter(
      (s) => s.hail !== hail.source || (s.at !== undefined && !hexEquals(s.at, hail.hex))
    );
}

export function clearHail(state: FightState, caster: Unit): void {
  state.effects = state.effects.filter((e) => e.source !== caster.id);
  for (const u of state.units) u.statuses = u.statuses.filter((s) => s.hail !== caster.id);
}

/** What an Invocation heals each ally: its Priest's power and the Empower he cast it with (owner, 2026-10-31). */
export function invocationHeal(user: Unit, v: ShotInAir): number {
  return user.power + shotEmpower(user, v);
}

/**
 * The Priest's Invocation landing, his charging card come back (owner,
 * 2026-10-31): every unit within `ABILITY.invocation.radius` of its space
 * now, each enemy hit for his power (the Empower he cast it with carried),
 * each ally, himself and the camel too, healed his power and that Empower
 * (`invocationHeal`).
 */
function landInvocation(ctx: Ctx, user: Unit, v: ShotInAir): void {
  log(ctx, `${unitName(user)}'s invocation lands.`);
  record(ctx.state, {kind: 'land', unitId: user.id, ability: 'invocation', target: v.hex!});
  const caught = sortByHex(
    ctx.state.units.filter(
      (u) => u.alive && u.hex && hexDistance(u.hex, v.hex!) <= ABILITY.invocation.radius
    ),
    (u) => u.hex!
  );
  for (const u of caught) {
    if (!u.alive) continue;
    if (u.side === user.side) heal(ctx, u, invocationHeal(user, v), user);
    else hit(ctx, user, u, `${unitName(user)}'s invocation`, shotEmpower(user, v));
  }
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
    if (v.ability === 'invocation' && v.hex) {
      landInvocation(ctx, user, v);
      continue;
    }
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
  if (!unit.alive || !unit.hex || isUnstoppable(unit) || !hailOn(ctx.state, unit.hex)) return;
  const hail = ctx.state.effects.find((e) => hexEquals(e.hex, unit.hex!))!;
  if (unit.statuses.some((s) => s.hail === hail.source && (!s.at || hexEquals(s.at, hail.hex))))
    return;
  log(ctx, `Hail holds ${unitName(unit)} fast.`);
  // What the caster's abilities give (`reach`) reaches whoever its hail holds.
  const caster = ctx.state.units.find((u) => u.id === hail.source);
  immobilize(
    ctx,
    unit,
    {kind: 'immobilized', hail: hail.source, ...(ABILITY.hail.max > 1 ? {at: {...hail.hex}} : {})},
    caster
  );
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
 * Stuns `u`, unless it is Unstoppable (17.4). A Stunned Grappler lets go of the unit it grapples
 * (owner, 2026-10-23), and a Stunned Outrider loses the arrow it has drawn
 * (owner, 2026-10-24): its card comes back as an ordinary turn, skipped
 * while it is Stunned.
 */
export function stun(ctx: Ctx, u: Unit, status: Status): void {
  if (isUnstoppable(u)) {
    log(ctx, `${unitName(u)} is Unstoppable: not Stunned.`);
    return;
  }
  addStatus(u, status);
  interrupt(ctx, u);
}

/**
 * What a Stun breaks besides the turn: a grapple `u` holds lets go, and an
 * arrow it has drawn is lost (owner, 2026-10-24).
 */
function interrupt(ctx: Ctx, u: Unit): void {
  endGrapples(ctx, (g) => g.champion === u.id);
  if (ctx.state.shots?.some((v) => v.source === u.id)) {
    const invoking = ctx.state.shots.some((v) => v.source === u.id && v.ability === 'invocation');
    ctx.state.shots = ctx.state.shots.filter((v) => v.source !== u.id);
    log(ctx, `${unitName(u)} loses ${invoking ? 'the invocation' : 'the drawn arrow'}.`);
  }
}

/**
 * What was a Stun for the unit's next turn (a Charge's slam in `stun` mode,
 * Last Stand's): a Delay of `RULES.durations.stun` slots (owner,
 * 2026-10-29), which Unstoppable still stops, breaking what a Stun breaks
 * (`interrupt`); with `defies`, it Delays an Inevitable unit too.
 */
export function stunForATurn(ctx: Ctx, u: Unit, defies = false): void {
  const n = RULES.durations.stun;
  if (isUnstoppable(u)) {
    log(ctx, `${unitName(u)} is Unstoppable: not Delayed.`);
    return;
  }
  interrupt(ctx, u);
  if (!defies) return delay(ctx, u, n);
  if (!u.alive || u.slot === null) return;
  placeCard(ctx.state, u, u.slot + n);
  log(ctx, `${unitName(u)} is Delayed ${n}.`);
}

/**
 * The track reaching `slot`: each grapple squeezes for every
 * `RULES.durations.turn` slots passed since its last squeeze, whoever's
 * card is there (owner, 2026-10-29; at the start of each of the Grappler's
 * turns from 2026-10-23).
 */
export function squeezeDue(ctx: Ctx, slot: number): void {
  const every = RULES.durations.turn;
  for (const u of ctx.state.units)
    for (const s of u.statuses) {
      while (s.grapple && s.squeezeAt !== undefined && s.squeezeAt <= slot) {
        s.squeezeAt += every;
        const champion = ctx.state.units.find((c) => c.id === s.grapple!.champion);
        if (!u.alive || !champion?.alive) break;
        squeeze(ctx, champion, u);
        if (ctx.state.phase !== 'fight') return;
      }
    }
}

/**
 * The track reaching `slot`: each Elixir's poison (`Unit.poison`) takes 1
 * for every `ABILITY.elixir.poisonEvery` slots passed since its last,
 * whoever's card is there, until its total is lost. Damage as hail's, no
 * hit: Armour doesn't hold against it, a Shield does.
 */
export function poisonDue(ctx: Ctx, slot: number): void {
  for (const u of ctx.state.units) {
    while (u.alive && u.poison && u.poison.at <= slot) {
      const {left, at, by: id} = u.poison;
      const by = ctx.state.units.find((c) => c.id === id);
      // A new object, not changed in place: `cloneFight` copies units shallowly.
      if (left > 1) u.poison = {left: left - 1, at: at + ABILITY.elixir.poisonEvery, by: id};
      else delete u.poison;
      applyDamage(ctx, u, 1, `The poison takes 1 from ${unitName(u)}`, by);
      if (ctx.state.phase !== 'fight') return;
    }
    if (!u.alive) delete u.poison;
  }
}

/** One squeeze of `champion`'s grapple on `u`: its squeeze, Empowered, Weakened, less Armour. */
function squeeze(ctx: Ctx, champion: Unit, u: Unit): void {
  const empowered = (champion.empower ?? 0) + passiveEmpower(champion, ctx.state);
  const strength = Math.max(
    0,
    ABILITY.grapple.squeeze +
      (ABILITY.grapple.empoweredSqueeze ? empowered : 0) -
      (champion.weaken ?? 0)
  );
  // Armour (Armoured, Plated) holds against the squeeze as against a hit.
  const amount = strength > 0 ? Math.max(0, strength - armourOf(ctx, u, champion.hex)) : 0;
  applyDamage(ctx, u, amount, `The grapple squeezes ${unitName(u)} for ${amount}`, champion);
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
  // On or next to its thrown axe (Reave): it picks it up.
  if (unit.axe && hexDistance(h, unit.axe) <= 1) {
    delete unit.axe;
    log(ctx, `${unitName(unit)} picks up its axe.`);
  }
  if (from) record(ctx.state, {kind: 'step', unitId: unit.id, from, to: h, how});
  if (!midWalk) endGrapplesApart(ctx, unit);
  if (ABILITY.hail.entry && hailOn(ctx.state, h)) {
    // `ABILITY.hail.entry` (owner, 2026-10-26): entering hail hurts, its caster's power.
    const source = ctx.state.effects.find((e) => hexEquals(e.hex, h))!.source;
    const caster = ctx.state.units.find((u) => u.id === source);
    if (caster) hit(ctx, caster, unit, 'The hail', 0);
  }
  // Moved onto scorched ground, not walking or leaping there: it burns (owner, 2026-10-28).
  if (how !== 'walk' && how !== 'leap') scorch(ctx, unit);
  // Fire burns whoever enters it, walking or Moved (owner, 2026-10-28).
  burn(ctx, unit, h);
  pickUpFan(ctx, unit);
  hailHolds(ctx, unit);
}

/**
 * Fire on `h` (Princess Iron Fan's Fan the Flames) burns `unit`, just entering
 * it: `ABILITY.fanFlames.burn`, from no one's power, credited to her.
 */
function burn(ctx: Ctx, unit: Unit, h: Hex): void {
  if (!unit.alive || !fireOn(ctx.state, h)) return;
  const fire = ctx.state.fires!.find((f) => hexEquals(f.hex, h))!;
  const source = ctx.state.units.find((u) => u.id === fire.source && u.alive);
  const n = ABILITY.fanFlames.burn;
  applyDamage(ctx, unit, n, `The flames burn ${unitName(unit)} for ${n}`, source);
}

/**
 * A hero entering the space where Princess Iron Fan's fan lies picks it up
 * (owner, 2026-10-28): it may spend a turn putting out the flames
 * (`quench`). Not Humphrey, nor the enemy.
 */
function pickUpFan(ctx: Ctx, unit: Unit): void {
  const fan = ctx.state.fan;
  if (!fan || !unit.alive || !unit.hex || !hexEquals(fan, unit.hex)) return;
  if (unit.side !== 'player' || unit.hero === CAMEL) return;
  delete ctx.state.fan;
  unit.fan = true;
  log(ctx, `${unitName(unit)} picks up the Iron Fan.`);
}

/**
 * Scorched ground burns `unit` if it stands on it (`scorched` in map.ts):
 * `RULES.scorch` damage from no one, taken as any damage is (a Shield
 * first). On a unit Moved onto it (`enterHex`) or ending its turn there
 * (`endTurnOn` in fight.ts).
 */
export function scorch(ctx: Ctx, unit: Unit): void {
  if (!unit.alive || !unit.hex || !scorched(ctx.map, unit.hex)) return;
  applyDamage(
    ctx,
    unit,
    RULES.scorch,
    `The scorched ground burns ${unitName(unit)} for ${RULES.scorch}`
  );
}

/**
 * Displaces `unit` up to `n` spaces along hex direction `dir` (Push and
 * Pull, keywords.md, 17.4): it stops early at a yurt, another unit or the
 * map's edge, with no collision damage (open question 55). Each space
 * entered triggers as a walk's does. A Rooted (19.8) or Unstoppable unit
 * isn't moved.
 */
export function displace(ctx: Ctx, unit: Unit, dir: number, n: number, how: Motion): void {
  if (hasPassive(unit, 'rooted')) {
    log(ctx, `${unitName(unit)} is Rooted.`);
    return;
  }
  if (isUnstoppable(unit)) {
    log(ctx, `${unitName(unit)} is Unstoppable.`);
    return;
  }
  for (let i = 0; i < n && unit.alive && unit.hex; i++) {
    const next = hexNeighbor(unit.hex, dir);
    if (!walkable(ctx.map, next) || unitAt(ctx.state, next)) break;
    enterHex(ctx, unit, next, how, true);
  }
  if (!unit.alive) return;
  endGrapplesApart(ctx, unit);
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
}

// ─── A grapple off the track ─────────────────────────────────────────────────

/**
 * `u`, just grappled by `champion`: its card leaves the track until the
 * grapple ends (owner, 2026-10-29; Stunned, its turns skipped, before).
 */
export function takeOffTrack(ctx: Ctx, u: Unit, champion: Unit): void {
  u.slot = null;
  u.heldBy = champion.id;
  log(ctx, `${unitName(u)}’s card is taken off the track.`);
}

/**
 * Where a held unit's card would come back now (`returnFreed`): the free
 * slot nearest before its Grappler's card, after the slot the track is on;
 * null when there is none (or no Grappler's card).
 */
export function returnSlot(state: FightState, u: Unit): number | null {
  const champion = state.units.find((c) => c.id === u.heldBy);
  if (!champion?.alive || champion.slot === null) return null;
  for (let s = champion.slot - 1; s > state.currentSlot; s--)
    if (!state.units.some((v) => v.alive && v.slot === s)) return s;
  return null;
}

/**
 * Each held card whose grapple has ended comes back:
 * just before its Grappler's next card (`returnSlot`), or with no slot free
 * there, in its Grappler's own slot, the Grappler's card moving on; with its
 * Grappler fallen, or its card not yet placed, at the next slot. After each
 * turn, once the Grappler's card is placed, and as the track goes on.
 */
export function returnFreed(state: FightState): void {
  for (const u of state.units) {
    if (u.heldBy === undefined) continue;
    if (u.alive && u.statuses.some((s) => s.grapple?.target === u.id)) continue;
    const champion = state.units.find((c) => c.id === u.heldBy);
    const at = u.alive ? returnSlot(state, u) : null;
    delete u.heldBy;
    if (!u.alive) continue;
    if (at !== null) u.slot = at;
    else if (champion?.alive && champion.slot !== null && champion.slot > state.currentSlot)
      placeCard(state, u, champion.slot, true);
    else placeCard(state, u, state.currentSlot + 1);
    logAt(state, state.currentSlot, `${unitName(u)}’s card comes back, at slot ${u.slot}.`);
  }
}

// ─── Durations in slots ──────────────────────────────────────────────────────

/**
 * The last slot an effect given now lasts through: `n` slots on, by
 * default `RULES.durations.turn` (owner, 2026-10-29).
 */
export function lastsThrough(state: FightState, n: number = RULES.durations.turn): number {
  return state.currentSlot + n;
}

/**
 * The track reaches `slot`: every effect whose last slot is behind it
 * ends, before the card there acts (`RULES.durations`). A fire stays for
 * good once its Princess Iron Fan has fallen.
 */
export function expireDurations(state: FightState, slot: number): void {
  for (const u of state.units) {
    if (u.empowerUntil !== undefined && u.empowerUntil < slot) {
      delete u.empower;
      delete u.empowerUntil;
    }
    if (u.weakenUntil !== undefined && u.weakenUntil < slot) {
      delete u.weaken;
      delete u.weakenUntil;
    }
    if (u.shieldUntil !== undefined && u.shieldUntil < slot) {
      if (u.lastingShield) u.shield = u.lastingShield;
      else delete u.shield;
      delete u.shieldUntil;
    }
    if (u.armourUntil !== undefined && u.armourUntil < slot) {
      delete u.armour;
      delete u.armourUntil;
    }
    u.statuses = u.statuses.filter((x) => x.until === undefined || x.until >= slot);
  }
  for (const hail of state.effects.filter((e) => e.until < slot)) liftHail(state, hail);
  if (state.fires) {
    const standing = (id: string) => state.units.some((u) => u.id === id && u.alive);
    state.fires = state.fires.filter((f) => f.until >= slot || !standing(f.source));
    if (!state.fires.length) delete state.fires;
  }
}
