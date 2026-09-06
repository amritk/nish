class Point {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

function test(): number {
  const p = new Point(1, 2);
  return p.z;
}
