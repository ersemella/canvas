import type {GameDefinition, GameManifest} from '@canvas/engine';
import manifest from '../game.json';

/**
 * Silk Road Tactics, the tactical roguelike planned in
 * docs/plans/roguelike-tactics/. Only the package so far: an empty scene.
 */
export const silkRoadTactics: GameDefinition = {
  id: 'silk-road-tactics',
  manifest: manifest as GameManifest,
};

export default silkRoadTactics;
