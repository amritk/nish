// A parallel body's own array handed to a function that keeps it is private
// no longer: `pass` hands the array back, writing nothing itself, so the
// body's store into it, before the call, is a shared write.
import { parallelMapInto } from "nish/threads";

const pass = (xs: f64[]): f64[] => xs;

const fresh = (x: i32): i32 => {
  const xs = new Array<f64>(x + 1);
  xs[0] = 1.0;
  pass(xs);
  return x;
};

export const main = (): i32 => {
  const src: i32[] = [1, 2];
  const out: i32[] = [0, 0];
  parallelMapInto(src, out, fresh);
  return out[0];
};
