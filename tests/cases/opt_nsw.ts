// The two fast defaults in one program (WP15 §3), compiled with no flags at all.
//
// Every user-level *signed* integer add/sub/mul — binary operators, unary
// minus, `op=` on locals, fields and elements, `++`/`--` — is either proven to
// fit and carries `nsw`, or is checked through `llvm.s*.with.overflow` and
// panics on overflow, so signed overflow is never undefined. Division and
// remainder have their own check, the compiler's own i64 index and length
// arithmetic is neither flagged nor checked, and neither is any unsigned
// operation: `u8`..`u64` are defined as wrapping. `tests/cases/opt_wrapping` is this same program under
// `--wrapping`, where nothing is flagged at all.
//
// `test` is exported because the C driver calls it; `poly`, `sum`, `mix` and
// the constructor are not, so the other default gives them `internal` linkage.
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
