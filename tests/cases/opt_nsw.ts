// Compiled with `--nsw` (see .args): every user-level integer add/sub/mul
// carries the no-signed-wrap flag, including unary minus, `op=` on locals,
// fields and elements, and `++`/`--`. Division and remainder never do, and
// neither does the compiler's own i64 index/length arithmetic.
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

function test(): number {
  const acc = new Acc();
  const xs = [1, 2, 3, 4];
  let n = poly(5, 2);
  n++;
  n--;
  return n + sum(xs, acc) + acc.total;
}
