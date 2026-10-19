import {BaseComponent} from '../core/Component';
import {hexDimensions} from '../math/Hex';
import type {HexOrientation} from '../math/Hex';

export type RenderType = 'rect' | 'text' | 'circle' | 'hex' | 'sprite';

/** A sprite-sheet frame to draw; see `SpriteRenderableData` in the manifest types. */
export interface SpriteData {
  image: string;
  frameWidth: number;
  frameHeight: number;
  frame?: number;
  animation?: {frames: number[]; fps: number};
  pivot?: {x: number; y: number};
  flipX?: boolean;
}

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
  orientation?: HexOrientation;
  sprite?: SpriteData;

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
      orientation?: HexOrientation;
      image?: string;
      frameWidth?: number;
      frameHeight?: number;
      frame?: number;
      animation?: {frames: number[]; fps: number};
      pivot?: {x: number; y: number};
      flipX?: boolean;
    } = {}
  ) {
    super();
    this.renderType = data.renderType ?? 'rect';
    if (this.renderType === 'sprite' && data.image !== undefined) {
      const sprite: SpriteData = {
        image: data.image,
        frameWidth: data.frameWidth ?? 32,
        frameHeight: data.frameHeight ?? 32,
      };
      if (data.frame !== undefined) sprite.frame = data.frame;
      if (data.animation !== undefined) sprite.animation = {...data.animation, frames: [...data.animation.frames]};
      if (data.pivot !== undefined) sprite.pivot = {...data.pivot};
      if (data.flipX !== undefined) sprite.flipX = data.flipX;
      this.sprite = sprite;
    }
    // Sprites default to their frame size, hexes to their bounding box (for clicks).
    const defaultSize = this.sprite
      ? {width: this.sprite.frameWidth, height: this.sprite.frameHeight}
      : this.renderType === 'hex'
        ? hexDimensions(data.orientation ?? 'pointy', data.radius ?? 16)
        : {width: 32, height: 32};
    this.width = data.width ?? defaultSize.width;
    this.height = data.height ?? defaultSize.height;
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
    if (data.orientation !== undefined) this.orientation = data.orientation;
  }
}
