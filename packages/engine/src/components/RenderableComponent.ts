import {BaseComponent} from 'core/Component';

export type RenderType = 'rect' | 'text' | 'circle';

export class RenderableComponent extends BaseComponent {
  readonly componentType = 'Renderable';
  static readonly componentType = 'Renderable';

  renderType: RenderType;
  width: number;
  height: number;
  zIndex: number;
  visible: boolean;
  color: string;
  borderColor?: string;
  borderWidth?: number;
  radius?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  bold?: boolean;
  textColor?: string;
  textAnchor?: 'center' | 'top-left';

  constructor(
    data: {
      renderType?: RenderType;
      width?: number;
      height?: number;
      zIndex?: number;
      visible?: boolean;
      color?: string;
      borderColor?: string;
      borderWidth?: number;
      radius?: number;
      text?: string;
      fontSize?: number;
      fontFamily?: string;
      bold?: boolean;
      textColor?: string;
      textAnchor?: 'center' | 'top-left';
    } = {}
  ) {
    super();
    this.renderType = data.renderType ?? 'rect';
    this.width = data.width ?? 32;
    this.height = data.height ?? 32;
    this.zIndex = data.zIndex ?? 0;
    this.visible = data.visible ?? true;
    this.color = data.color ?? '#ffffff';
    if (data.borderColor !== undefined) this.borderColor = data.borderColor;
    if (data.borderWidth !== undefined) this.borderWidth = data.borderWidth;
    if (data.radius !== undefined) this.radius = data.radius;
    if (data.text !== undefined) this.text = data.text;
    if (data.fontSize !== undefined) this.fontSize = data.fontSize;
    if (data.fontFamily !== undefined) this.fontFamily = data.fontFamily;
    if (data.bold !== undefined) this.bold = data.bold;
    if (data.textColor !== undefined) this.textColor = data.textColor;
    if (data.textAnchor !== undefined) this.textAnchor = data.textAnchor;
  }
}
