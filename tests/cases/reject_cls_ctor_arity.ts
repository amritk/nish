class Point {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

export function test(): number {
  const p = new Point(1);
  return p.x;
}
