/**
 * What the board draws for the turn being planned (`BoardScene`): the
 * highlights, path, range, lanes and arcs for Move or the chosen ability,
 * whose health shows, and the previewed outcome. Pure, so the page only
 * decides when to send it.
 */
import {
  hexDistance,
  hexEquals,
  hexKey,
  hexNeighbor,
  hexNeighbors,
  hexRing,
  hexesInRange,
} from '@canvas/engine';
import type {Hex} from '@canvas/engine';
import {ABILITIES, arrowLanes, mapOf, onMap, targetAt, unitAt} from '@canvas/games-silk-road-run';
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

/** The hexes along a straight hex line from `from` to `to`, `to` included, or null if they aren't on one. */
function laneTo(fight: FightState, from: Hex, to: Hex): Hex[] | null {
  const map = mapOf(fight);
  for (let dir = 0; dir < 6; dir++) {
    const hexes: Hex[] = [];
    let h = from;
    while (onMap(map, (h = hexNeighbor(h, dir)))) {
      hexes.push(h);
      if (hexEquals(h, to)) return hexes;
    }
  }
  return null;
}

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
    previewBumps: preview?.bumped ?? {},
  };
  if (!fight) return out;
  if (!acting) return out;
  if (ability && isAttack(ability)) {
    // An attack: every enemy, and the allies in the line of fire: those it
    // can target (the units Longshot's lanes reach, a melee ability's
    // neighbours) and those the aimed ability would hurt.
    const ids = new Set(fight.units.filter((u) => u.side === 'enemy').map((u) => u.id));
    const def = ABILITIES[ability];
    if (def.targetsUnit)
      for (const t of targets) {
        const u = def.aimedAt ? def.aimedAt(fight, acting, t) : t.hex && unitAt(fight, t.hex);
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
    // How far it reaches, outlined (Hail's ring inside and out); Longshot's lanes, an arrow along each to
    // an enemy it can hit, so it's plain why the others can't be.
    const def = ABILITIES[ability];
    const from = acting.hex;
    if (from && def.range) {
      const map = mapOf(fight);
      out.range = hexesInRange(from, def.range).filter(
        (h) =>
          hexDistance(h, from) <= def.range! &&
          hexDistance(h, from) >= (def.minRange ?? 0) &&
          onMap(map, h)
      );
    }
    // The Bow's lanes: Longshot's, Feigned Retreat's before its target is
    // picked; Haul's, as far as it reaches.
    const lanesShown =
      ability === 'longshot' ||
      (ability === 'feignedRetreat' && !target?.hex) ||
      ability === 'haul';
    if (from && lanesShown)
      out.lanes = {
        from,
        lanes: arrowLanes(fight, mapOf(fight), from).map((l) => ({
          hexes: def.range ? l.hexes.slice(0, def.range) : l.hexes,
          target: targets.some((t) => t.hex && l.hit?.hex && hexEquals(t.hex, l.hit.hex)),
        })),
      };
    // Who the turn Pushes or Pulls (Shove, Haul, Gale), and where to; a
    // second pick's move (Throw's landing) is drawn as `step` instead.
    if (preview && !targets.some((t) => t.to)) {
      const displaced: [Hex, Hex][] = [];
      for (const c of preview.changes) {
        const u = fight.units.find((v) => v.id === c.unitId);
        // The user too: a Gale beside it blows it away.
        if (u?.hex && c.to && !c.killed && !hexEquals(u.hex, c.to)) displaced.push([u.hex, c.to]);
      }
      if (displaced.length) out.displaced = displaced;
    }
    // Only what it may target; once Feigned Retreat's target is picked,
    // where it can fall back to, and Grapple's throws, where the held unit
    // can land, dashed so they never read as more targets. Skirmish first offers
    // the spaces to step to, dashed, then the targets in line from the one
    // picked (or hovered), with the step drawn as a move's and an arrow's
    // line to each.
    const shown = new Set<string>();
    const show = (h: Hex | undefined, kind: HighlightKind) => {
      if (!h || shown.has(hexKey(h))) return;
      shown.add(hexKey(h));
      highlights.push({hex: h, kind});
    };
    const hovered = hoverHex;
    if (def.steps) {
      const hoveredStep =
        !target?.to && hovered && targets.some((t) => t.to && hexEquals(t.to, hovered))
          ? hovered
          : undefined;
      const step = target?.to ?? hoveredStep;
      if (!target?.to) for (const t of targets) show(t.to, 'landing');
      if (step && from) {
        out.step = [from, step];
        const lines: {hexes: Hex[]; target: boolean}[] = [];
        for (const t of targets) {
          if (!hexEquals(t.to!, step)) continue;
          if (target?.to) show(t.hex, 'target');
          const line = laneTo(fight, step, t.hex!);
          if (line) lines.push({hexes: line, target: true});
        }
        out.lanes = {from: step, lanes: lines};
      }
    } else {
      // Picked second: Feigned Retreat's walk.
      const second = targets.some((t) => t.to) && target?.hex;
      // A Grapple's throw: a space without a unit, or the Grappler's own.
      const throws = (h: Hex) => {
        if (ability !== 'grapple') return false;
        const u = unitAt(fight, h);
        return !u || u.id === acting.id;
      };
      // Cleave's line: every unit each swing would hit, not just the
      // space it's aimed at, so a swing that catches several shows them all.
      if (def.area && from)
        for (const t of targets)
          for (const h of def.area(mapOf(fight), from, t.hex!)) {
            const u = unitAt(fight, h);
            if (u && u.id !== acting.id) show(h, 'target');
          }
      else
        for (const t of targets)
          show(
            second ? (hexEquals(t.hex!, target!.hex!) ? t.to : undefined) : t.hex,
            (second && !def.pairs) || throws(t.hex!) ? 'landing' : 'target'
          );
      // Where Feigned Retreat falls back to: the space hovered, else the one
      // picked, drawn as a move's.
      const hoveredLanding =
        hovered && target?.hex
          ? targets.find((t) => t.to && hexEquals(t.hex!, target.hex!) && hexEquals(t.to, hovered))
              ?.to
          : undefined;
      const landing = hoveredLanding ?? target?.to;
      if (second && landing && !def.pairs) out.step = [def.walksAfter && from ? from : target.hex!, landing];
    }
    // Cleave's line, before it's aimed: the one under the mouse, by any of its spaces.
    const hoveredAim =
      !target?.hex && from && hovered
        ? targetAt(mapOf(fight), from, def, targets, hovered)?.hex
        : undefined;
    if (def.area && from && hoveredAim)
      for (const h of def.area(mapOf(fight), from, hoveredAim))
        if (!hexEquals(h, hoveredAim)) highlights.push({hex: h, kind: 'area'});
    if (target?.hex) {
      // An area ability: highlight the area around the chosen hex (none since Hail covers one space),
      // or the one running out from the user (Cleave's line).
      const radius = ABILITIES[ability].radius;
      if (def.area && from) {
        for (const h of def.area(mapOf(fight), from, target.hex))
          if (!hexEquals(h, target.hex)) highlights.push({hex: h, kind: 'area'});
      } else if (radius) {
        const map = mapOf(fight);
        for (const h of hexesInRange(target.hex, radius))
          if (hexDistance(h, target.hex) <= radius && onMap(map, h))
            highlights.push({hex: h, kind: 'area'});
      }
      highlights.push({hex: target.hex, kind: 'chosen'});
    }
    if (target?.to) highlights.push({hex: target.to, kind: 'chosen'});
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
 * `hexes` (all near `from`) with the holes in them filled: allies, yurts and
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
