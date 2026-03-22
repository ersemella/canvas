import {registerDataComponent} from 'core/Component';

export interface ChildOfData {
  parentId: string;
  offsetX: number;
  offsetY: number;
  zIndexOffset: number;
  syncZIndex?: boolean; // defaults to true; set false to sync position only
}

registerDataComponent<ChildOfData>('ChildOf');
