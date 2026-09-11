// Escape-analysed stack allocation (WP6): objects that provably do not outlive
// their function become entry-block allocas. No `nish_alloc_struct` anywhere
// in this module.
interface Pair {
  first: number;
  second: number;
}

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

class Counter {
  count: number = 0;
  step: number = 3;
}

function sumX(p: Point, q: Point): number {
  return p.x + q.x;
}

// An object literal that is only read: own memory, so the function is `readnone`.
function swapped(a: number, b: number): number {
  const p: Pair = { first: b, second: a };
  return p.first * 10 + p.second;
}

// A class without a constructor: the initializers are stored inline, then written and read: `readnone` too.
function count(n: number): number {
  const c = new Counter();
  c.count = n;
  c.count += c.step;
  return c.count;
}

// Constructed objects are allocas; the constructor still writes through `this`.
function nearest(): number {
  const p = new Point(3, 4);
  const q = new Point(10, 20);
  const alias = p;
  return sumX(alias, q) + p.manhattan() + new Point(1, 1).manhattan();
}

export function main(): number {
  console.log(swapped(1, 2));
  console.log(count(4));
  console.log(nearest());
  return 0;
}
