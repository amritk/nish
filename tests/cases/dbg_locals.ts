class Point {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  sum(): number {
    return this.x + this.y;
  }
}

function label(p: Point, name: string): string {
  return `${name}: ${p.sum()}`;
}

function total(values: number[]): number {
  let acc = 0;
  for (const v of values) {
    acc += v;
  }
  return acc;
}

function test(): number {
  const p = new Point(3, 4);
  const ok: boolean = p.sum() === 7;
  const big: i64 = 1;
  const ratio: f64 = 2.5;
  const s = label(p, "p");
  const t = total([1, 2, 3]);
  if (ok && big === 1 && ratio > 2.0 && s.length === 4) {
    return t + p.sum();
  }
  return 0;
}
