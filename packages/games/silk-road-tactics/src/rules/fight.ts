/**
 * The fight's flow: creating it, deployment, the track advancing card by
 * card, start-of-turn effects, charged abilities triggering, and applying
 * one turn's move and action (timeline.md; brief sections 2 and 8).
 */
import {hexEquals, hexKey} from '@canvas/engine/server';
import {ARMOUR, HEROES, PARTY, movementRules} from './config';
import {expireStatuses, invalidPath, walkable} from './board';
import {ABILITIES, sameTarget, unusableReason} from './abilities';
import {obeysTaunt, redirectedCharge, tauntBinds, taunterOf} from './taunt';
import {applyHail, checkEnd, enterHex, log, damageEachSlot, record, unitName} from './resolve';
import type {Ctx} from './resolve';
import {MAPS, SALT_FLATS} from './map';
import type {MapData} from './map';
import {nextCard, placeCard, placeStartingCards, slotsForward, turnCost} from './track';
import type {Deployment, FightState, Side, TurnInput, Unit} from './types';

/** A player-facing rule violation; the server sends its message back. */
export class RuleError extends Error {}

export function mapOf(state: FightState): MapData {
  return MAPS[state.mapId]!;
}

function makeUnit(side: Side, partyIndex: number): Unit {
  const hero = PARTY[partyIndex]!;
  const stats = HEROES[hero];
  const armour = ARMOUR[stats.armour];
  return {
    id: `${side === 'player' ? 'p' : 'e'}-${hero}`,
    hero,
    side,
    controller: side === 'player' ? 'human' : 'ai',
    partyIndex,
    hex: null,
    hp: stats.health,
    maxHp: stats.health,
    speed: stats.speed - armour.speed,
    defence: stats.defence + armour.defence,
    power: stats.power,
    slot: null,
    statuses: [],
    turnsTaken: 0,
    ultimateUsed: false,
    charging: null,
    alive: true,
  };
}

/**
 * A new fight on the Salt Flats: both parties, the enemy placed from one of
 * the map's layouts (the seed picks it), the player's waiting to deploy.
 */
export function createFight(seed: number): FightState {
  const map = SALT_FLATS;
  const state: FightState = {
    mapId: map.id,
    mode: 'solo',
    phase: 'deploy',
    currentSlot: 0,
    units: [
      ...PARTY.map((_, i) => makeUnit('player', i)),
      ...PARTY.map((_, i) => makeUnit('enemy', i)),
    ],
    effects: [],
    fog: [],
    log: [],
    awaiting: null,
  };
  const layout = map.enemyLayouts[seed % map.enemyLayouts.length]!;
  state.units.filter((u) => u.side === 'enemy').forEach((u, i) => (u.hex = layout[i]!));
  return state;
}

/** The player's default placement, for the deployment screen. */
export function defaultDeployment(state: FightState): Deployment[] {
  const map = mapOf(state);
  return state.units
    .filter((u) => u.side === 'player')
    .map((u, i) => ({unitId: u.id, hex: map.playerLayout[i]!}));
}

/** Places the player's party in its zone and starts the clock (brief section 8). */
export function deploy(state: FightState, placements: Deployment[]): void {
  if (state.phase !== 'deploy') throw new RuleError('The fight has already started.');
  const map = mapOf(state);
  const party = state.units.filter((u) => u.side === 'player');
  const seen = new Set<string>();
  for (const unit of party) {
    const p = placements.find((d) => d.unitId === unit.id);
    if (!p) throw new RuleError(`Place every hero (missing ${HEROES[unit.hero].name}).`);
    if (!map.deployment.player.some((h) => hexEquals(h, p.hex)) || !walkable(map, p.hex)) {
      throw new RuleError('Heroes must start in your deployment zone.');
    }
    if (seen.has(hexKey(p.hex))) throw new RuleError('Two heroes can’t share a hex.');
    seen.add(hexKey(p.hex));
  }
  if (placements.length !== party.length) throw new RuleError('Place each hero once.');
  for (const unit of party) unit.hex = placements.find((d) => d.unitId === unit.id)!.hex;
  state.phase = 'fight';
  placeStartingCards(state);
  log({state, map, slot: 0}, 'The fight begins.');
}

/** The unit whose turn it is, once the track has stopped for a human. */
export function actingUnit(state: FightState): Unit | undefined {
  return state.awaiting ? state.units.find((u) => u.id === state.awaiting) : undefined;
}

/**
 * Runs the track until a human-controlled unit's turn (start-of-turn
 * effects applied) or the fight's end. `chooseAi` picks each AI turn.
 */
export function advance(
  state: FightState,
  chooseAi: (state: FightState, unit: Unit) => TurnInput
): void {
  let unit: Unit | undefined;
  for (let guard = 0; guard < 10_000 && (unit = advanceToDecision(state)); guard++) {
    if (unit.controller === 'human') return;
    applyTurn(state, unit, chooseAi(state, unit));
  }
}

/**
 * Advances automatic effects and charges to the next decision, on either
 * side. Shared by live play and search; resuming a stopped decision does
 * not apply its start-of-turn effects a second time.
 * `spend` lets search bound automatic cards as well as simulated actions.
 */
export function advanceToDecision(state: FightState, spend?: () => void): Unit | undefined {
  if (state.phase !== 'fight') return;
  if (state.awaiting) return actingUnit(state);
  const map = mapOf(state);
  // A safety bound; a fight never takes anywhere near this many cards.
  for (let guard = 0; guard < 10_000 && state.phase === 'fight' && !state.awaiting; guard++) {
    const unit = nextCard(state);
    if (!unit) return;
    spend?.();
    const ctx: Ctx = {state, map, slot: unit.slot!};
    beginSlot(ctx);
    record(state, {kind: 'turn', unitId: unit.id});

    // Start of the turn: hail (brief section 2); quicksand and Crushed ticked in beginSlot.
    applyHail(ctx, unit);
    if (state.phase !== 'fight') return;
    if (!unit.alive) continue;

    if (unit.charging) {
      triggerCharge(ctx, unit);
      continue;
    }
    state.awaiting = unit.id;
    return unit;
  }
}

/**
 * The track reaches `ctx.slot`: effects act at the beginning of each slot
 * passed (3.9), here expiry (statuses, hail, fog), quicksand and Crushed.
 */
function beginSlot(ctx: Ctx): void {
  const {state, slot} = ctx;
  const from = state.currentSlot;
  state.currentSlot = slot;
  damageEachSlot(ctx, from, (s) => {
    for (const u of state.units) expireStatuses(u, s);
  });
  for (const u of state.units) expireStatuses(u, slot);
  state.effects = state.effects.filter((e) => e.untilSlot >= slot);
  state.fog = (state.fog ?? []).filter((f) => f.untilSlot >= slot);
}

function triggerCharge(ctx: Ctx, unit: Unit): void {
  const {ability, target} = unit.charging!;
  const def = ABILITIES[ability];
  const hex = redirectedCharge(ctx.state, ctx.map, unit, target);
  unit.charging = null;
  if (!hexEquals(hex, target))
    log(ctx, `${unitName(unit)}'s ${def.name} is drawn onto its taunter.`);
  record(ctx.state, {kind: 'action', unitId: unit.id, ability, target: hex, charged: true});
  def.resolve(ctx, unit, {hex});
  checkEnd(ctx.state);
  if (unit.alive)
    placeCard(ctx.state, unit, ctx.slot + slotsForward(def.recoveryCost!, unit.speed));
  unit.turnsTaken++;
}

/**
 * Applies one turn for `unit` (the acting unit): validates and resolves
 * the move or the ability, then places its card (3.2). Throws RuleError
 * with a player-facing message for an illegal turn. Validation happens as
 * the turn resolves, so apply it to a copy and keep the copy only if it
 * doesn't throw. `trustTarget` skips re-listing the targets and the taunt
 * check, for the AI's own options, which it took from that list and
 * filtered by the taunt.
 */
export function applyTurn(
  state: FightState,
  unit: Unit,
  input: TurnInput,
  trustTarget = false
): void {
  const map = mapOf(state);
  const ctx: Ctx = {state, map, slot: state.currentSlot};
  const def = ABILITIES[input.action.ability];
  if (!def) throw new RuleError('Unknown ability.');
  const reason = unusableReason(unit, def);
  if (reason) throw new RuleError(reason);
  const path = input.move ?? [];
  if (movementRules(state).separateMovement && path.length > 0 && def.id !== 'hold')
    throw new RuleError('Movement and an ability require separate turns.');
  // Move + Hold encodes a move-only action without changing the turn protocol.
  const cost = turnInputCost(state, input);
  // Taunt (17.5): decided from where the turn starts, before any move. The
  // AI's own options already obey it (trustTarget).
  const taunter = trustTarget ? undefined : taunterOf(state, unit);
  const bound = taunter !== undefined && tauntBinds(state, map, unit, taunter);

  const move = () => {
    if (path.length === 0 || !unit.alive) return;
    const bad = invalidPath(state, map, unit, path);
    if (bad) throw new RuleError(bad);
    // Quicksand and hail trigger on entering each hex, allies' hexes passed included.
    for (const h of path) {
      enterHex(ctx, unit, h);
      if (!unit.alive) return;
    }
  };
  const act = () => {
    if (!unit.alive) return;
    if (movementRules(state).separateMovement && path.length > 0) {
      log(ctx, `${unitName(unit)} moves.`);
      return;
    }
    const target = input.action.target ?? {};
    if (
      !trustTarget &&
      !def.targets(state, map, unit, unit.hex!).some((t) => sameTarget(t, target))
    ) {
      throw new RuleError(`${def.name} can’t target that.`);
    }
    if (bound && !obeysTaunt(map, def, unit.hex!, target, taunter)) {
      throw new RuleError(`Taunted: attack ${unitName(taunter)} or end the turn.`);
    }
    if (def.ultimate) unit.ultimateUsed = true;
    if (def.charged) {
      unit.charging = {ability: def.id, target: target.hex!};
      log(ctx, `${unitName(unit)} begins charging ${def.name}.`);
      record(state, {kind: 'charge', unitId: unit.id, ability: def.id, target: target.hex!});
    } else {
      record(state, {
        kind: 'action',
        unitId: unit.id,
        ability: def.id,
        ...(target.hex ? {target: target.hex} : {}),
      });
      def.resolve(ctx, unit, target);
    }
  };

  if (input.actFirst) {
    act();
    move();
  } else {
    move();
    act();
  }
  state.awaiting = null;
  checkEnd(state);
  if (unit.alive) placeCard(state, unit, state.currentSlot + slotsForward(cost, unit.speed));
  if (countsTowardUltimate(input)) unit.turnsTaken++;
}

/** The authoritative cost, shared by the server, AI simulations and previews. */
export function turnInputCost(state: FightState, input: TurnInput): number {
  const hexes = input.move?.length ?? 0;
  const base =
    movementRules(state).separateMovement && hexes > 0
      ? movementRules(state).moveActionCost
      : ABILITIES[input.action.ability].cost;
  return turnCost(base, hexes);
}

/**
 * A turn counts toward the ultimate (10.10) unless it only Holds: with
 * Hold this cheap, Holding in place would otherwise unlock it in a few
 * slots (owner, 2026-10-19).
 */
export function countsTowardUltimate(input: TurnInput): boolean {
  return input.action.ability !== 'hold' || (input.move?.length ?? 0) > 0;
}

/** A deep copy for previews and the AI; drops the log unless asked, and the events always. */
export function cloneFight(state: FightState, keepLog = false): FightState {
  // A copy never records: only the run's own fight does, from a fresh list.
  const {events: _events, ...rest} = state;
  return {
    ...rest,
    units: state.units.map((u) => ({
      ...u,
      hex: u.hex ? {...u.hex} : null,
      statuses: u.statuses.map((s) => ({...s})),
      charging: u.charging ? {...u.charging, target: {...u.charging.target}} : null,
    })),
    effects: state.effects.map((e) => ({...e, hex: {...e.hex}})),
    fog: (state.fog ?? []).map((f) => ({...f, hex: {...f.hex}})),
    log: keepLog ? state.log.map((l) => ({...l})) : [],
  };
}
