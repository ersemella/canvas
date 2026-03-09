import {BaseComponent} from 'core/Component';

export class RenderableComponent extends BaseComponent {
  readonly componentType = 'Renderable';
  static readonly componentType = 'Renderable';

  sprite: string;
  width: number;
  height: number;
  zIndex: number;
  layer: string;
  visible: boolean;
  color: string;
  text?: string;
  fontSize?: number;
  textColor?: string;

  constructor(
    data: {
      sprite?: string;
      width?: number;
      height?: number;
      zIndex?: number;
      layer?: string;
      visible?: boolean;
      color?: string;
      text?: string;
      fontSize?: number;
      textColor?: string;
    } = {}
  ) {
    super();
    this.sprite = data.sprite ?? '';
    this.width = data.width ?? 32;
    this.height = data.height ?? 32;
    this.zIndex = data.zIndex ?? 0;
    this.layer = data.layer ?? 'default';
    this.visible = data.visible ?? true;
    this.color = data.color ?? '#ffffff';
    if (data.text !== undefined) this.text = data.text;
    if (data.fontSize !== undefined) this.fontSize = data.fontSize;
    if (data.textColor !== undefined) this.textColor = data.textColor;
  }
}
