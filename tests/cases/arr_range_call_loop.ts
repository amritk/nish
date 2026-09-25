// WP15 §2.4, the shape a caller proves on its own: the loop is bounded by
// `this.v.length`, so every call to `bump` passes an `i` below the length of the
// array `bump` reads through its own `this`. `bump` stores no field and calls
// nothing, so the fact holds where it indexes, and the golden has no
// `nish_panic_index` in `Counts.bump`. `total` indexes a local after a call in
// the same loop: `touch` stores `calls` and resizes nothing, so `i < xs.length`
// survives it and `total` has no check either.
class Counts {
  v: i32[];
  calls: i32 = 0;

  constructor(n: i32) {
    this.v = new Array<i32>(n);
  }

  touch(): void {
    this.calls += 1;
  }

  bump(i: i32, by: i32): void {
    this.v[i] = this.v[i] + by;
  }

  fill(): void {
    for (let i = 0; i < this.v.length; i += 1) {
      this.bump(i, i);
      this.bump(i, 1);
    }
  }
}

const total = (c: Counts, xs: i32[]): i32 => {
  let s = 0;
  for (let i = 0; i < xs.length; i += 1) {
    c.touch();
    s = s + xs[i];
  }
  return s;
};

export const main = (): number => {
  const c = new Counts(4);
  c.fill();
  console.log(`${c.v[0]} ${c.v[1]} ${c.v[2]} ${c.v[3]}`);
  console.log(`${total(c, c.v)}`);
  return 0;
};
