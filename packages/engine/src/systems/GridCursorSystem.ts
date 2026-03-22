import {BaseSystem} from 'core/System';
import type {SystemContext} from 'core/System';
import type {DataComponent} from 'core/Component';
import type {GridCursorData} from 'components/GridCursorComponent';
import {inputService} from 'systems/InputSystem';
import {mouseService} from 'systems/MouseSystem';

export interface GridCursorPayload {
  entityId: string;
  row: number;
  col: number;
}

export class GridCursorSystem extends BaseSystem {
  readonly priority = 60;

  onUpdate({scene, events}: SystemContext): void {
    const cursors = scene.query({all: ['GridCursor']});

    for (const entity of cursors) {
      const cursor = entity.getComponent<DataComponent<GridCursorData>>('GridCursor')!;
      const {rows, cols, cellSize, originX, originY} = cursor.data;
      let {selectedRow, selectedCol} = cursor.data;
      let changed = false;

      if (inputService.isActionJustPressed('moveUp')) {
        if (selectedRow === -1) { selectedRow = 0; selectedCol = 0; }
        else selectedRow = Math.max(0, selectedRow - 1);
        changed = true;
      }
      if (inputService.isActionJustPressed('moveDown')) {
        if (selectedRow === -1) { selectedRow = 0; selectedCol = 0; }
        else selectedRow = Math.min(rows - 1, selectedRow + 1);
        changed = true;
      }
      if (inputService.isActionJustPressed('moveLeft')) {
        if (selectedCol === -1) { selectedRow = 0; selectedCol = 0; }
        else selectedCol = Math.max(0, selectedCol - 1);
        changed = true;
      }
      if (inputService.isActionJustPressed('moveRight')) {
        if (selectedCol === -1) { selectedRow = 0; selectedCol = 0; }
        else selectedCol = Math.min(cols - 1, selectedCol + 1);
        changed = true;
      }

      if (mouseService.justDown) {
        const col = Math.floor((mouseService.position.x - originX) / cellSize);
        const row = Math.floor((mouseService.position.y - originY) / cellSize);
        if (row >= 0 && row < rows && col >= 0 && col < cols) {
          selectedRow = row;
          selectedCol = col;
          changed = true;
        }
      }

      if (changed) {
        cursor.data.selectedRow = selectedRow;
        cursor.data.selectedCol = selectedCol;
        events.emit<GridCursorPayload>('cursor:moved', {entityId: entity.id, row: selectedRow, col: selectedCol});
      }
    }
  }
}
