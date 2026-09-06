interface Vec {
  x: number;
  y: number;
}

class Counter {
  count: number = 0;
  readonly step: number;

  constructor(step: number) {
    this.step = step;
  }

  tick(): number {
    this.count += this.step;
    return this.count;
  }
}

function dot(a: Vec, b: Vec): number {
  return a.x * b.x + a.y * b.y;
}

export function run(n: number): number {
  const c = new Counter(3);
  let last = 0;
  for (let i = 0; i < n; i++) {
    last = c.tick();
  }
  const v: Vec = { x: last, y: 2 };
  return dot(v, v);
}
