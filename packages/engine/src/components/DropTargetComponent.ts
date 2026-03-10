import {registerDataComponent} from 'core/Component';

export interface DropTargetData {
  targetId: string;
}

registerDataComponent<DropTargetData>('DropTarget');
