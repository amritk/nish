// `tests/cases/opt_nsw` under `--wrapping` (see .args): the identical source, so
// the two goldens differ in exactly one thing — no `nsw` appears anywhere, and
// signed overflow is two's-complement wrapping again. The unsigned half of
// `mix` is unchanged, because unsigned arithmetic was never flagged.
//
// The source is duplicated rather than shared so that a diff of the two `.ll`
// files is a diff of the flag and nothing else.
class Acc {
  total: number;
  constructor() {
    this.total = 0;
  }
}

function poly(x: number, y: number): number {
  return x * x - 3 * y + -x;
}

function sum(xs: number[], acc: Acc): number {
  let s = 0;
  for (let i = 0; i < xs.length; i++) {
    s += xs[i];
    xs[i] *= 2;
    acc.total -= xs[i] / 2;
  }
  return s % 1000;
}

/** Unsigned arithmetic: the same three instructions, and never a no-wrap flag. */
function mix(a: u32, b: u32): u32 {
  let m = a * b;
  m += a - b;
  m--;
  return m;
}

export function test(): number {
  const acc = new Acc();
  const xs = [1, 2, 3, 4];
  let n = poly(5, 2);
  n++;
  n--;
  return n + sum(xs, acc) + acc.total + toI32(mix(3, 2));
}
