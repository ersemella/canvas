// Silk Road Run, the tactical roguelike planned in
// docs/plans/roguelike-tactics/. The client entry (this file) is the game
// definition the web shell builds in, plus the rules its page uses for
// previews. The server-authoritative rules run in the platform's RunRoom
// through the DOM-free `./server` entry; the page sends turns over HTTP.

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
        // the map's own hexes by TacticsInputSystem (odd rows reach column −1).
        HexGrid: {orientation: 'pointy', size: BOARD_LAYOUT.size, columns: 8, rows: 8},
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
export {HERO_PORTRAIT, hexOverlaySpan} from './client/board/units';
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
export {ABILITIES, abilitiesOf, arrowLanes, unusableReason} from './rules/abilities';
export type {AbilityDef, AbilityKind, ArrowLane} from './rules/abilities';
export {CAMEL_RULE, EXIT_INFO, KEYWORD_INFO, TILE_INFO, hailInfo, shotInfo} from './rules/info';
export type {HexInfo, KeywordId} from './rules/info';
export {ABILITY, HEROES, PARTY, ROSTER, RULES, healthOf} from './rules/config';
export {
  isImmobilized,
  isStunned,
  movementCap,
  plainSand,
  shotLane,
  reachableHexes,
  unitAt,
} from './rules/board';
export type {Reach} from './rules/board';
export {actingUnit, cloneFight, mapOf} from './rules/fight';
export {atExit, camelOf, enterHex, unitName} from './rules/resolve';
export {aimSlot, chargeOf} from './rules/track';
export {previewTurn, unitOptions} from './rules/preview';
export {chooseAiTurn} from './rules/ai';
export {allowedTargets, offeredTargets, onlyHold} from './rules/choices';
export type {EnemyOption, TurnPreview, UnitChange} from './rules/preview';
export {SALT_FLATS, onMap, tileAt} from './rules/map';
export type {MapData, Tile} from './rules/map';
export type {RunView} from './rules/run';
export type * from './rules/types';
