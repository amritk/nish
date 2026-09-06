export interface Size {
  width: number;
  height: number;
}

export class Point {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  shifted(dx: number): Point {
    return new Point(this.x + dx, this.y);
  }
}

export function area(s: Size): number {
  return s.width * s.height;
}
