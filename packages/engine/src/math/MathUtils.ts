export const MathUtils = {
  clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  },

  lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  },

  degToRad(deg: number): number {
    return (deg * Math.PI) / 180;
  },

  radToDeg(rad: number): number {
    return (rad * 180) / Math.PI;
  },

  randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  randomFloat(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  },
};
