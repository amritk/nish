// WP33 NL8009 on the parameters of an arrow that captures (WP29): a captured
// name is appended to the arrow's parameters after the written ones, so the
// row lines the written parameters up with their types from the end of those,
// not of every parameter. `x` is an `i32` beside a captured `i64` (quiet), an
// `i64` beside a captured `i32` (reported), and both of `parallelReduce`'s
// operands are `i64` beside one capture (both reported). The captured locals
// are reported where they are declared, as any other local is.
import { parallelMap, parallelReduce } from "nish/threads";

const narrowBesideWide = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  const big: i64 = 4;
  const ys = parallelMap(xs, (x) => x + toI32(big));
  return ys[2];
};

const wideBesideNarrow = (): i64 => {
  const xs: i64[] = [1, 2, 3];
  const k: i32 = 2;
  const ys = parallelMap(xs, (x) => (k > 1 ? x * 2 : x));
  return ys[2];
};

const reduceWide = (): i64 => {
  const xs: i64[] = [1, 2, 3];
  const step: i64 = 10;
  return parallelReduce(xs, (a, x) => a + x + step, 0);
};

export const main = (): i32 => {
  console.log(`${narrowBesideWide()} ${toI32(wideBesideNarrow())} ${toI32(reduceWide())}`);
  return 0;
};
