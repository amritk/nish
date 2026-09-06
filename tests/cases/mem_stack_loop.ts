// A per-iteration temporary in a hot loop (WP6): the alloca is hoisted to the
// entry block once and reused every iteration; the arena never grows.
class Vec {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  dot(o: Vec): number {
    return this.x * o.x + this.y * o.y;
  }
}

function accumulate(n: number): number {
  let total = 0;
  for (let i = 0; i < n; i++) {
    const v = new Vec(i, 1);
    const w = new Vec(1, i);
    total += v.dot(w) % 7;
  }
  return total;
}

export function main(): number {
  const before = Arena.used();
  const total = accumulate(100000);
  const flat = Arena.used() === before;
  console.log(total);
  console.log(flat);
  return 0;
}
