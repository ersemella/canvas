/**
 * What the board draws for the turn being planned (`BoardScene`): the
 * highlights, path, range, lanes and arcs for Move or the chosen ability,
 * whose health shows, and the previewed outcome. Pure, so the page only
 * decides when to send it.
 */
import {hexDistance, hexEquals, hexKey, hexNeighbors, hexRing, hexesInRange} from '@canvas/engine';
import type {Hex} from '@canvas/engine';
import {ABILITIES, arrowLanes, mapOf, onMap, unitAt} from '@canvas/games-silk-road-run';
import type {
  AbilityId,
  ActionTarget,
  BoardScene,
  FightState,
  HighlightKind,
  Reach,
  TurnPreview,
  Unit,
} from '@canvas/games-silk-road-run';

/** Abilities that deal damage: aiming one shows the health of whoever it could hit. */
const isAttack = (id: AbilityId) => ABILITIES[id].kind === 'attack';

export interface SceneInput {
  fight: FightState | null;
  /** The unit whose turn it is, if it's a human's. */
  acting: Unit | undefined;
  phone: boolean;
  /** The unit tapped or whose track card was. */
  selectedId: string | null;
  /** Phones: the unit the details feature. */
  featuredId: string | null;
  /** The hex under the mouse, plain sand included. */
  hoverHex: Hex | null;
  preview: TurnPreview | null;
  // The turn being planned (see `useTurnPlan`).
  ability: AbilityId | null;
  target: ActionTarget | null;
  targets: ActionTarget[];
  moving: boolean;
  moveMode: boolean;
  plannedMove: Reach | null;
  hoverReach: Reach | undefined;
  reaches: Reach[];
}

export function buildScene(input: SceneInput): BoardScene {
  const {fight, acting, phone, selectedId, featuredId, hoverHex, preview} = input;
  const {ability, target, targets, moving, moveMode, plannedMove, hoverReach, reaches} = input;
  const highlights: {hex: Hex; kind: HighlightKind}[] = [];
  const out: BoardScene = {
    fight,
    highlights,
    selectedUnitId: selectedId ?? acting?.id ?? null,
    inspectedUnitId: phone ? featuredId : selectedId,
    // Phones show whose turn it is in the action bar instead (see `TurnControls`).
    turnArrow: !phone,
    preview: [],
    previewSlot: preview?.slot ?? null,
    aimSlot: preview?.aimSlot ?? null,
  };
  if (!fight) return out;
  if (!acting) return out;
  if (ability && isAttack(ability)) {
    // An attack: every enemy, and the allies in the line of fire: those it
    // can target (the units the bow's lanes reach, a melee ability's
    // neighbours) and those the aimed ability would hurt.
    const ids = new Set(fight.units.filter((u) => u.side === 'enemy').map((u) => u.id));
    if (ABILITIES[ability].targetsUnit)
      for (const t of targets) {
        const u = t.hex && unitAt(fight, t.hex);
        if (u) ids.add(u.id);
      }
    for (const c of preview?.changes ?? []) if (c.hpAfter < c.hpBefore) ids.add(c.unitId);
    out.healthUnitIds = [...ids];
  }
  if (moveMode && !moving && !plannedMove) {
    // Desktop, nothing picked: only the hex under the mouse, if it can be
    // reached, and the way there, so the board stays clear; the bounds of
    // where the unit can move, outlined as an ability's range is.
    if (hoverReach && acting.hex) {
      for (const h of hoverReach.path.slice(0, -1)) highlights.push({hex: h, kind: 'path'});
      highlights.push({hex: hoverReach.hex, kind: 'target'});
      out.path = [acting.hex, ...hoverReach.path];
      out.range = filledIn(
        acting.hex,
        reaches.map((r) => r.hex)
      );
    }
  } else if (moveMode) {
    // Like an ability's targets: every reachable hex stays open to pick,
    // the planned one chosen and the steps on the way to it marked.
    const onPath = (h: Hex) => plannedMove?.path.some((p) => hexEquals(p, h));
    if (moving)
      for (const r of reaches)
        if (r.path.length > 0 && !onPath(r.hex)) highlights.push({hex: r.hex, kind: 'target'});
    if (plannedMove) {
      for (const h of plannedMove.path.slice(0, -1)) highlights.push({hex: h, kind: 'path'});
      highlights.push({hex: plannedMove.hex, kind: 'chosen'});
      if (acting.hex) out.path = [acting.hex, ...plannedMove.path];
    }
  } else if (ability) {
    // How far it reaches, outlined; the bow's lanes, an arrow along each to
    // an enemy it can hit, so it's plain why the others can't be.
    const def = ABILITIES[ability];
    const from = acting.hex;
    if (from && def.range) {
      const map = mapOf(fight);
      out.range = hexesInRange(from, def.range).filter(
        (h) => hexDistance(h, from) <= def.range! && onMap(map, h)
      );
    }
    if (from && ability === 'bow')
      out.lanes = {
        from,
        lanes: arrowLanes(fight, mapOf(fight), from).map((l) => ({
          hexes: l.hexes,
          target: targets.some((t) => t.hex && l.hit?.hex && hexEquals(t.hex, l.hit.hex)),
        })),
      };
    // Only what it may target; once Throw's target is picked, where it can
    // land, dashed so it never reads as more targets.
    const shown = new Set<string>();
    const throwing = ability === 'throw' && target?.hex;
    for (const t of targets) {
      const h = throwing ? (hexEquals(t.hex!, target!.hex!) ? t.to : undefined) : t.hex;
      if (!h || shown.has(hexKey(h))) continue;
      shown.add(hexKey(h));
      highlights.push({hex: h, kind: throwing ? 'landing' : 'target'});
    }
    // Where the thrown unit lands: the landing hovered, else the one picked,
    // drawn as a move's.
    const hovered = hoverHex;
    const hoveredLanding =
      hovered && target?.hex
        ? targets.find((t) => t.to && hexEquals(t.hex!, target.hex!) && hexEquals(t.to, hovered))
            ?.to
        : undefined;
    const landing = hoveredLanding ?? target?.to;
    if (throwing && landing) out.step = [target.hex!, landing];
    if (target?.hex) {
      // An area ability: highlight the area around the chosen hex (none since Hail covers one space).
      const radius = ABILITIES[ability].radius;
      if (radius) {
        const map = mapOf(fight);
        for (const h of hexesInRange(target.hex, radius))
          if (hexDistance(h, target.hex) <= radius && onMap(map, h))
            highlights.push({hex: h, kind: 'area'});
      }
      highlights.push({hex: target.hex, kind: 'chosen'});
      if (target.to) highlights.push({hex: target.to, kind: 'chosen'});
    }
  }
  if (preview) {
    out.preview = preview.changes.map((c) => ({
      unitId: c.unitId,
      to: c.to,
      hpAfter: c.hpAfter,
      hpBefore: c.hpBefore,
      killed: c.killed,
    }));
  } else if (plannedMove) {
    out.preview = [
      {
        unitId: acting.id,
        to: plannedMove.hex,
        hpAfter: acting.hp,
        hpBefore: acting.hp,
        killed: false,
      },
    ];
  }
  return out;
}

/**
 * `hexes` (all near `from`) with the holes in them filled: allies, ruins and
 * the like a move can't end on but stand inside its reach, so only the
 * outer bounds get outlined.
 */
function filledIn(from: Hex, hexes: Hex[]): Hex[] {
  const inside = new Set(hexes.map(hexKey));
  const radius = Math.max(0, ...hexes.map((h) => hexDistance(h, from))) + 1;
  // Whatever the ring just outside them reaches without crossing them is outside.
  const outside = new Set<string>();
  let frontier = hexRing(from, radius);
  for (const h of frontier) outside.add(hexKey(h));
  while (frontier.length > 0) {
    const next: Hex[] = [];
    for (const h of frontier)
      for (const n of hexNeighbors(h)) {
        const key = hexKey(n);
        if (hexDistance(n, from) > radius || inside.has(key) || outside.has(key)) continue;
        outside.add(key);
        next.push(n);
      }
    frontier = next;
  }
  return hexesInRange(from, radius).filter((h) => !outside.has(hexKey(h)));
}
