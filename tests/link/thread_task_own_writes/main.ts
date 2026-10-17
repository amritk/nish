// A task writes memory only it reaches: a holder it made and pokes through a
// method, a `Map` and a `Set` it made and fills, the array fields of an
// object it made, an array it made handed back by a helper that returns its
// argument, and an array it made under a second name bound in the same
// statement. None of it is reachable from the caller, so spawn order and join
// order print the same.
import { scope } from "nish/threads";

class Holder {
  n: i32 = 0;

  poke(): void {
    this.n = this.n + 1;
  }
}

class Bins {
  xs: i32[];

  constructor() {
    this.xs = [0, 0];
  }
}

/** Hands back the array it is given, or a fresh one: either way its caller's. */
const keep = (xs: i32[], n: i32): i32[] => {
  if (n > 4) {
    return [0, 0];
  }
  return xs;
};

const poked = (k: i32): i32 => {
  const h = new Holder();
  h.poke();
  h.poke();
  return h.n * k;
};

const tables = (k: i32): i32 => {
  const m = new Map<i32, i32>();
  m.set(k, k * 2);
  m.set(k + 1, 3);
  const s = new Set<i32>();
  s.add(k);
  s.add(k);
  return m.size * 100 + (m.get(k) ?? 0) * 10 + s.size;
};

const binned = (k: i32): i32 => {
  const b = new Bins();
  b.xs[0] = k;
  b.xs.push(k + 1);
  return b.xs[0] + b.xs[2] + b.xs.length;
};

const kept = (k: i32): i32 => {
  const own = [0, 0];
  const xs = keep(own, 1);
  xs[1] = k;
  return own[1];
};

const declared = (n: i32): i32 => {
  const k: i32 = 2,
    xs = new Array<i32>(n),
    ys = xs;
  xs.fill(0);
  xs[0] = k * n;
  return ys[0];
};

export const main = (): i32 => {
  const out: i32[] = [0, 0, 0, 0, 0];
  {
    using s = scope();
    s.spawn(poked, 3, out, 0);
    s.spawn(tables, 4, out, 1);
    s.spawn(binned, 5, out, 2);
    s.spawn(kept, 6, out, 3);
    s.spawn(declared, 7, out, 4);
  }
  console.log(`${out[0]} ${out[1]} ${out[2]} ${out[3]} ${out[4]}`);
  return 0;
};
