// WP29: `parallelMap` from `nish/threads` allocates its result before the
// region and maps into it: with a named function, with an arrow, and over an
// empty array, which answers an empty one. Every array is shorter than the
// grain, so each region is one chunk run on the calling thread.
import { parallelMap } from "nish/threads";

const square = (x: f64): f64 => x * x;

export const main = (): i32 => {
  const src: f64[] = [1.0, 2.0, 3.0, 4.0];
  const squares = parallelMap(src, square);
  const ns: i32[] = [1, 2, 3];
  const halves = parallelMap(ns, (n) => toF64(n) / 2.0);
  const none: i32[] = [];
  const empty = parallelMap(none, (n) => n + 1);
  console.log(`${squares.length} ${squares[3]} ${halves[2]} ${empty.length}`);
  return 0;
};
