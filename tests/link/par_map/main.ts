// WP29 P1: `parallelMapInto` from `nish/threads` with a named function, with an
// arrow, and in place, over arrays far shorter than the grain, so every region
// is one chunk run on the calling thread: the loop it would have been.
import { parallelMapInto } from "nish/threads";

const square = (x: f64): f64 => x * x;

export const main = (): i32 => {
  const src: f64[] = [1.0, 2.0, 3.0, 4.0];
  const dst: f64[] = [0.0, 0.0, 0.0, 0.0, 9.0];
  parallelMapInto(src, dst, square);
  const ns: i32[] = [1, 2, 3];
  const halves: f64[] = [0.0, 0.0, 0.0];
  parallelMapInto(ns, halves, (n) => toF64(n) / 2.0);
  // In place: each element is read and written by the one thread that owns it.
  parallelMapInto(dst, dst, (x) => x + 1.0);
  console.log(`${dst[0]} ${dst[3]} ${dst[4]} ${halves[2]}`);
  return 0;
};
