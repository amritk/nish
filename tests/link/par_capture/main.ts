// WP29: an arrow passed to a data-parallel form reads the `const` locals and
// the parameters of the function it is written in. Each one it reads is a
// parameter of the arrow, passed from the call through every instance on the
// way to the body: a scalar by value, and a reference that no body may write
// through. Every form takes one here — a scalar, an array, a string, an
// object, a narrowed nullable, a parameter, a `const` array beside a `dst`
// that is a `const` array of its own, which the body may read, a parameter
// array beside a fresh `dst`, the same inside a generic function, and an
// object bound from `this` in a method.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

class Weights {
  scale: i32 = 3;

  /** `this` is not captured, but a `const` bound to it is a reference like any other. */
  scaled(xs: i32[]): i32 {
    const self = this;
    return parallelMap(xs, (x) => x * self.scale)[1];
  }
}

/** A parameter's array was there before `dst` was made, so the two are two arrays. */
const lookUp = (table: i32[], xs: i32[]): i32 => {
  const dst: i32[] = [0, 0, 0, 0];
  parallelMapInto(xs, dst, (x) => table[x % 4]);
  return dst[2];
};

/** Two fresh `const` arrays in a generic function, judged in its instantiation's own tables. */
const offsetBy = <T>(tag: T[], xs: i32[]): i32 => {
  const t: i32[] = [5, 6];
  const d: i32[] = [0, 0, 0, 0];
  parallelMapInto(xs, d, (x) => t[0] + x + toI32(tag.length));
  return d[3];
};

/** `k` is a parameter, read by the body as a capture. */
const scaledBy = (xs: i32[], k: i32): i32[] => parallelMap(xs, (x) => x * k);

/** The capture's narrowing at the call holds in the body, because a `const` cannot change. */
const weighted = (w: Weights | null, xs: i32[]): i32 => {
  if (w !== null) {
    return parallelMap(xs, (x) => x * w.scale)[3];
  }
  return -1;
};

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3, 4];
  const k: i32 = 3;
  const b: i32 = 1;
  const ys = parallelMap(xs, (x) => x * k + b);
  const table: i32[] = [10, 20, 30, 40];
  const dst: i32[] = [0, 0, 0, 0];
  parallelMapInto(xs, dst, (x) => table[x % 4] * k);
  const word = "nish";
  const codes = parallelFrom(4, (i) => word.charCodeAt(i) + b);
  const w = new Weights();
  // Addition modulo a captured `m` is associative, and 0 is its identity on the
  // residues: a block folded from 0 answers its sum mod `m`, and so does the
  // combine, so every grouping gives the sum of `ys` mod `m`.
  const m: i32 = 7;
  const sum = parallelReduce(ys, (acc, y) => (acc + y) % m, 0);
  const by = scaledBy(xs, 5);
  console.log(`${ys[3]} ${dst[0]} ${dst[3]} ${codes[0]} ${codes[3]} ${sum} ${by[2]} ${weighted(w, xs)}`);
  const tag: f64[] = [1.5];
  console.log(`${w.scaled(xs)} ${lookUp(table, xs)} ${offsetBy(tag, xs)}`);
  return 0;
};
