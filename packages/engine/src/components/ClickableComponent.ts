import {registerDataComponent} from 'core/Component';

export interface ClickableData {
  enabled: boolean;
}

registerDataComponent<ClickableData>('Clickable');
