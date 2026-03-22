import {registerDataComponent} from 'core/Component';

export interface DragGroupData {
  groupId: string;   // empty string = not in a group
  groupOrder: number;
}

registerDataComponent<DragGroupData>('DragGroup');
