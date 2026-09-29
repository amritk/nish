export class Point {
  x: i32;
  y: i32;

  constructor(x: i32, y: i32) {
    this.x = x;
    this.y = y;
  }
}

// `Pt` names the class declared above it, so in `main.ts` a `Pt` is a `Point`:
// one struct, reached through either name.
export type Pt = Point;

export const at = (x: i32, y: i32): Pt => new Point(x, y);
