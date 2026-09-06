class Point {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  manhattan(): number {
    return this.x + this.y;
  }
}

function sumX(p: Point, q: Point): number {
  return p.x + q.x;
}

export function main(): number {
  const p = new Point(3, 4);
  const q = new Point(10, 20);
  console.log(p.manhattan());
  console.log(sumX(p, q));
  console.log(p.y);
  return 0;
}
