import {registerDataComponent} from 'core/Component';

export interface DraggableData {
  enabled: boolean;
}

registerDataComponent<DraggableData>('Draggable');
