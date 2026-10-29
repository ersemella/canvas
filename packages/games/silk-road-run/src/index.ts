// Caravan, the tactical roguelike planned in
// docs/plans/roguelike-tactics/. The client entry (this file) is the game
// definition the web shell builds in, plus the rules its page uses for
// previews. The whole run plays in the browser through the DOM-free `./run`
// entry (docs/plans/client-side-runs.md), its AI in a Web Worker.

import {SystemRegistry} from '@canvas/engine';
import type {EntityData, GameDefinition, GameManifest} from '@canvas/engine';
import manifest from '../game.json';
import {TacticsBoardSystem} from './client/TacticsBoardSystem';
import {BOARD_LAYOUT, SCENE_SIZE} from './client/layout';
import {TacticsInputSystem} from './client/TacticsInputSystem';

/**
 * The board: a HexGrid entity. Its tiles are drawn by the board system
 * (`drawGround`), so they need no entities of their own.
 */
function boardEntities(): EntityData[] {
  const transform = (x: number, y: number) => ({
    position: {x, y},
    rotation: 0,
    scale: {x: 1, y: 1},
  });
  return [
    {
      id: 'board',
      components: {
        Transform: transform(BOARD_LAYOUT.origin.x, BOARD_LAYOUT.origin.y),
        // The board's grid. Its rectangle is nominal: taps are picked against
        // the map's own hexagon by TacticsInputSystem.
        HexGrid: {orientation: 'flat', size: BOARD_LAYOUT.size, columns: 9, rows: 9},
      },
    },
  ];
}

export const silkRoadRun: GameDefinition = {
  id: 'silk-road-run',
  manifest: {
    ...(manifest as GameManifest),
    scene: {...(manifest as GameManifest).scene, entities: boardEntities()},
  },
  register() {
    SystemRegistry.register('TacticsBoardSystem', TacticsBoardSystem);
    SystemRegistry.register('TacticsInputSystem', TacticsInputSystem);
  },
};

export default silkRoadRun;

// What the platform's page uses: the board's drawing contract and the
// rules, run locally for previews (D11).
export {BOARD_LAYOUT, SCENE_SIZE, TacticsBoardSystem};
export {HERO_ART, HERO_PORTRAIT, HERO_SPRITE, hexOverlaySpan} from './client/board/units';
export {TRACK_AREA, trackCards} from './client/layout';
export {openingPlayback} from './client/playback';
export type {PlaybackPayload} from './client/playback';
export {PALETTE, PIXEL_FONT} from './client/palette';
export type {PaletteColor} from './client/palette';
export type {BoardScene, HighlightKind} from './client/board/scene';
export type {
  TacticsCardPayload,
  TacticsHoverPayload,
  TacticsTapPayload,
} from './client/TacticsInputSystem';
export {
  ABILITIES,
  abilitiesOf,
  arrowLanes,
  axeLines,
  forks,
  longshotLanes,
  longshotLines,
  unusableReason,
} from './rules/abilities';
export type {AbilityDef, AbilityKind, ArrowLane} from './rules/abilities';
export {
  CAMEL_RULE,
  EXIT_INFO,
  SEALED_EXIT_INFO,
  FAN_INFO,
  KEYWORD_INFO,
  TILE_INFO,
  fireInfo,
  hailInfo,
  shotInfo,
  tileInfo,
} from './rules/info';
export type {HexInfo, KeywordId} from './rules/info';
export {ABILITY, HEROES, PARTY, ROSTER, RULES, healthOf} from './rules/config';
export type {Rarity} from './rules/config';
export {PASSIVES, passivesOf} from './rules/passives';
export type {PassiveDef, PassiveGroup} from './rules/passives';
export {
  exitSealed,
  isImmobilized,
  isStunned,
  movementCap,
  plainSand,
  shotLane,
  reachableHexes,
  unitAt,
} from './rules/board';
export type {Reach} from './rules/board';
export {actingUnit, cloneFight, makeUnit, mapOf} from './rules/fight';
export {atExit, camelOf, enterHex, unitName} from './rules/resolve';
export {aimSlot, chargeOf} from './rules/track';
export {previewTurn, unitOptions} from './rules/preview';
export {chooseAiTurn} from './rules/ai';
export {allowedTargets, castableSpaces, offeredTargets, onlyHold, targetAt} from './rules/choices';
export type {EnemyOption, TurnPreview, UnitChange} from './rules/preview';
export {DOME, FLAMING, GOBI, MAPS, SALT, STEPPE, TUFF, mapById, onMap, tileAt} from './rules/map';
export type {MapData, Tile} from './rules/map';
export {cardRarity, isStatCard} from './rules/run';
export type {DraftView, RunView} from './rules/run';
export type * from './rules/types';
