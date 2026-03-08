import { Vec2 } from './Vec2';

export class Rect {
  constructor(
    public x: number,
    public y: number,
    public width: number,
    public height: number
  ) {}

  get right(): number {
    return this.x + this.width;
  }

  get bottom(): number {
    return this.y + this.height;
  }

  get center(): Vec2 {
    return new Vec2(this.x + this.width / 2, this.y + this.height / 2);
  }

  intersects(other: Rect): boolean {
    return (
      this.x < other.right &&
      this.right > other.x &&
      this.y < other.bottom &&
      this.bottom > other.y
    );
  }

  contains(point: Vec2): boolean {
    return (
      point.x >= this.x &&
      point.x <= this.right &&
      point.y >= this.y &&
      point.y <= this.bottom
    );
  }

  clone(): Rect {
    return new Rect(this.x, this.y, this.width, this.height);
  }
}
