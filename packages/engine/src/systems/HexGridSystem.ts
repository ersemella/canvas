import {BaseSystem} from '../core/System';
import type {SystemContext} from '../core/System';
import type {DataComponent} from '../core/Component';
import type {TransformComponent} from '../components/TransformComponent';
import type {HexGridData, HexPositionData} from '../components/HexGridComponent';
import {hexToOffset, hexToPixel, pixelToHex} from '../math/Hex';
import type {Hex, HexLayout, OffsetCoord} from '../math/Hex';
import {mouseService} from './MouseSystem';

export interface HexGridClickPayload {
  /** Id of the entity with the `HexGrid` that was tapped. */
  gridId: string;
  hex: Hex;
  offset: OffsetCoord;
}

/** The pixel layout of a `HexGrid` entity, for drawing or picking outside this system. */
export function hexGridLayout(grid: HexGridData, transform: TransformComponent): HexLayout {
  return {
    orientation: grid.orientation,
    size: grid.size,
    origin: {x: transform.position.x, y: transform.position.y},
  };
}

/** True if a hex lies on the grid's `columns` × `rows` rectangle. */
export function isOnHexGrid(grid: HexGridData, h: Hex): boolean {
  const {col, row} = hexToOffset(h, grid.orientation, grid.parity ?? 'odd');
  return col >= 0 && col < grid.columns && row >= 0 && row < grid.rows;
}

/**
 * Hex maps: keeps every `HexPosition` entity's Transform on its hex's
 * centre, and turns a tap (pointer release, not consumed by a drag) on a
 * `HexGrid` into a `hexgrid:click` event. Needs `MouseSystem` for taps.
 * Hex geometry lives in `math/Hex`; game rules (movement, line of fire)
 * belong to the game.
 */
export class HexGridSystem extends BaseSystem {
  // After drag-drop (49) and click (55), before layout and child transforms.
  readonly priority = 56;

  onUpdate({scene, events}: SystemContext): void {
    const grids = new Map<string, {data: HexGridData; layout: HexLayout}>();
    for (const entity of scene.query({all: ['HexGrid', 'Transform']})) {
      const data = entity.getComponent<DataComponent<HexGridData>>('HexGrid')!.data;
      grids.set(entity.id, {
        data,
        layout: hexGridLayout(data, entity.getComponent<TransformComponent>('Transform')!),
      });
    }

    for (const entity of scene.query({all: ['HexPosition', 'Transform']})) {
      const pos = entity.getComponent<DataComponent<HexPositionData>>('HexPosition')!.data;
      const grid = grids.get(pos.grid);
      if (!grid) continue;
      const {x, y} = hexToPixel(pos, grid.layout);
      const transform = entity.getComponent<TransformComponent>('Transform')!;
      transform.position.x = x;
      transform.position.y = y;
    }

    if (!mouseService.justUp || mouseService.upConsumed) return;
    for (const [gridId, {data, layout}] of grids) {
      const h = pixelToHex(mouseService.position, layout);
      if (!isOnHexGrid(data, h)) continue;
      events.emit<HexGridClickPayload>('hexgrid:click', {
        gridId,
        hex: h,
        offset: hexToOffset(h, data.orientation, data.parity ?? 'odd'),
      });
    }
  }
}
