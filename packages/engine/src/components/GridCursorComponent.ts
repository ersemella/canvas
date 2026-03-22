import {registerDataComponent} from 'core/Component';

export interface GridCursorData {
  rows: number;
  cols: number;
  cellSize: number;
  originX: number;
  originY: number;
  selectedRow: number;
  selectedCol: number;
}

registerDataComponent<GridCursorData>('GridCursor');
