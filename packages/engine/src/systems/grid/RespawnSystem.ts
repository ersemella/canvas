import {BaseSystem, type SystemContext} from 'core/System';
import type {DataComponent} from 'core/Component';
import type {Scene} from 'core/Scene';
import type {TransformComponent} from 'components/TransformComponent';
import type {CollectibleData} from 'systems/grid/CollectSystem';
import type {TrailData} from 'systems/grid/TrailSystem';

export interface RespawnData {
  gridSize: number;
  width: number;
  height: number;
}

const cellKey = (x: number, y: number) => `${x},${y}`;

/**
 * Picks a random cell center that isn't in `occupied`, or null if the grid
 * is full. Exported for tests.
 */
export function pickFreeCell(
  cols: number,
  rows: number,
  gridSize: number,
  occupied: ReadonlySet<string>,
  random: () => number = Math.random
): {x: number; y: number} | null {
  const half = gridSize / 2;
  const free: Array<{x: number; y: number}> = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const x = c * gridSize + half;
      const y = r * gridSize + half;
      if (!occupied.has(cellKey(x, y))) free.push({x, y});
    }
  }
  if (free.length === 0) return null;
  return free[Math.floor(random() * free.length)]!;
}

/** Cells taken by moving entities, their trails, and other collectibles. */
function occupiedCells(scene: Scene, exceptId: string): Set<string> {
  const occupied = new Set<string>();
  const add = (id: string) => {
    const t = scene.getEntity(id)?.getComponent<TransformComponent>('Transform');
    if (t) occupied.add(cellKey(t.position.x, t.position.y));
  };
  for (const e of scene.query({all: ['GridMovement', 'Transform']})) add(e.id);
  for (const e of scene.query({all: ['Trail']})) {
    const trail = e.getComponent<DataComponent<TrailData>>('Trail');
    for (const segId of trail?.data.segments ?? []) add(segId);
  }
  for (const e of scene.query({all: ['Collectible', 'Transform']})) {
    if (e.id !== exceptId) add(e.id);
  }
  return occupied;
}

export class RespawnSystem extends BaseSystem {
  readonly priority = 215;

  onUpdate(context: SystemContext): void {
    const {scene} = context;
    const entities = scene.query({all: ['Collectible', 'Respawn', 'Transform']});

    for (const entity of entities) {
      const collectible = entity.getComponent<DataComponent<CollectibleData>>('Collectible');
      const respawn = entity.getComponent<DataComponent<RespawnData>>('Respawn');
      const transform = entity.getComponent<TransformComponent>('Transform');
      if (!collectible || !respawn || !transform || !collectible.data.collected) continue;

      const {gridSize, width, height} = respawn.data;
      const cell = pickFreeCell(
        Math.floor(width / gridSize),
        Math.floor(height / gridSize),
        gridSize,
        occupiedCells(scene, entity.id)
      );
      // A full grid leaves the collectible where it is.
      if (cell) {
        transform.position.x = cell.x;
        transform.position.y = cell.y;
      }
      collectible.data.collected = false;
    }
  }
}
