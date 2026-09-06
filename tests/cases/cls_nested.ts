class Point {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

class Segment {
  from: Point;
  to: Point;
  label: string;

  constructor(from: Point, to: Point, label: string) {
    this.from = from;
    this.to = to;
    this.label = label;
  }

  dx(): number {
    return this.to.x - this.from.x;
  }
}

function endpoint(s: Segment): Point {
  return s.to;
}

export function main(): number {
  const s = new Segment(new Point(1, 2), new Point(11, 22), "diag");
  console.log(s.dx());
  console.log(endpoint(s).y);
  s.from.x = 100;
  console.log(s.from.x);
  console.log(s.label);
  return 0;
}
