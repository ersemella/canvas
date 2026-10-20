// Silk Road Tactics, the tactical roguelike planned in
// docs/plans/roguelike-tactics/. The client entry (this file) is the game
// definition the web shell builds in, plus the rules its page uses for
// previews. The server-authoritative rules run in the platform's RunRoom
// through the DOM-free `./server` entry; the page sends turns over HTTP.

import {SystemRegistry} from '@canvas/engine';
import type {EntityData, GameDefinition, GameManifest} from '@canvas/engine';
import manifest from '../game.json';
import {BOARD_LAYOUT, SCENE_SIZE, TacticsBoardSystem} from './client/TacticsBoardSystem';
import {TacticsInputSystem} from './client/TacticsInputSystem';
import {SALT_FLATS, tileAt} from './rules/map';
import type {Tile} from './rules/map';

const TILE_COLOR: Record<Tile, string> = {
  sand: '#d4b483',
  obstacle: '#8a7864',
  hazard: '#a8834a',
  conceal: '#bfb6a3',
};

/** The board: a HexGrid entity and one hex entity per tile of the map. */
function boardEntities(): EntityData[] {
  const map = SALT_FLATS;
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
        // Places the tiles. Its rectangle is nominal: taps are picked against
        // the map's own hexes by TacticsInputSystem (odd rows reach column −1).
        HexGrid: {orientation: 'pointy', size: BOARD_LAYOUT.size, columns: 9, rows: 7},
      },
    },
    ...map.hexes.map((h) => ({
      id: `tile-${h.q}-${h.r}`,
      components: {
        Transform: transform(0, 0),
        Renderable: {
          renderType: 'hex' as const,
          radius: BOARD_LAYOUT.size - 0.5,
          color: TILE_COLOR[tileAt(map, h)],
          borderColor: '#8c7350',
          borderWidth: 1,
          zIndex: 0,
        },
        HexPosition: {grid: 'board', q: h.q, r: h.r},
      },
    })),
  ];
}

export const silkRoadTactics: GameDefinition = {
  id: 'silk-road-tactics',
  manifest: {
    ...(manifest as GameManifest),
    scene: {...(manifest as GameManifest).scene, entities: boardEntities()},
  },
  register() {
    SystemRegistry.register('TacticsBoardSystem', TacticsBoardSystem);
    SystemRegistry.register('TacticsInputSystem', TacticsInputSystem);
  },
};

export default silkRoadTactics;

// What the platform's page uses: the board's drawing contract and the
// rules, run locally for previews (D11).
export {BOARD_LAYOUT, SCENE_SIZE, TacticsBoardSystem};
export type {BoardScene, HighlightKind} from './client/TacticsBoardSystem';
export type {
  TacticsCardPayload,
  TacticsHoverPayload,
  TacticsTapPayload,
} from './client/TacticsInputSystem';
export {ABILITIES, abilitiesOf, arrowLanes, unusableReason} from './rules/abilities';
export type {AbilityDef, ArrowLane} from './rules/abilities';
export {TILE_INFO, hailInfo} from './rules/info';
export type {HexInfo} from './rules/info';
export {ABILITY, HEROES, RULES} from './rules/config';
export {
  isFlanked,
  movementCap,
  reachableHexes,
  statusSlotsLeft,
  statusValue,
  unitAt,
} from './rules/board';
export type {Reach} from './rules/board';
export {actingUnit, cloneFight, defaultDeployment, mapOf} from './rules/fight';
export {enterHex, unitName} from './rules/resolve';
export {slotsForward, turnCost} from './rules/track';
export {afterAction, previewTurn, unitOptions} from './rules/preview';
export {chooseAiTurn} from './rules/ai';
export {taunterOf} from './rules/taunt';
export type {EnemyOption, TurnPreview, UnitChange} from './rules/preview';
export {SALT_FLATS, onMap, tileAt} from './rules/map';
export type {MapData, Tile} from './rules/map';
export type {RunView} from './rules/run';
export type * from './rules/types';
