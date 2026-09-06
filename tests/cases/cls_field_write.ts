class Counter {
  count: number;
  step: number;

  constructor(step: number) {
    this.count = 0;
    this.step = step;
  }
}

// Writes through `c`: no `readonly` on the parameter.
function bump(c: Counter): void {
  c.count = c.count + c.step;
}

// Only reads through `c`, but passes it to `bump`, which writes: no `readonly` either.
function bumpTwice(c: Counter): number {
  bump(c);
  bump(c);
  return c.count;
}

export function main(): number {
  const c = new Counter(5);
  c.step = 7;
  console.log(bumpTwice(c));
  c.count = 100;
  console.log(c.count);
  return 0;
}
