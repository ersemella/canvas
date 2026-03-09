export class Vec2 {
  constructor(
    public x: number = 0,
    public y: number = 0
  ) {}

  add(other: Vec2): Vec2 {
    return new Vec2(this.x + other.x, this.y + other.y);
  }

  sub(other: Vec2): Vec2 {
    return new Vec2(this.x - other.x, this.y - other.y);
  }

  scale(s: number): Vec2 {
    return new Vec2(this.x * s, this.y * s);
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize(): Vec2 {
    const len = this.length();
    return len === 0 ? new Vec2() : this.scale(1 / len);
  }

  dot(other: Vec2): number {
    return this.x * other.x + this.y * other.y;
  }

  clone(): Vec2 {
    return new Vec2(this.x, this.y);
  }

  equals(other: Vec2): boolean {
    return this.x === other.x && this.y === other.y;
  }

  static zero(): Vec2 {
    return new Vec2(0, 0);
  }

  static one(): Vec2 {
    return new Vec2(1, 1);
  }

  static from(obj: {x: number; y: number}): Vec2 {
    return new Vec2(obj.x, obj.y);
  }
}
