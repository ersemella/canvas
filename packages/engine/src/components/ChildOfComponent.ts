import {registerDataComponent} from 'core/Component';

export interface ChildOfData {
  parentId: string;
  offsetX: number;
  offsetY: number;
  zIndexOffset: number;
}

registerDataComponent<ChildOfData>('ChildOf');
