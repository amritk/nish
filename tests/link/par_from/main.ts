// WP29: `parallelFrom(n, f)` from `nish/threads` is a new array of `n`
// elements, `f(i)` at index `i`, like `Array.from({ length: n }, (_, i) =>
// f(i))`: with an arrow, with a named function, and with `n` zero, which
// answers an empty array. Each region is one chunk on the calling thread.
import { parallelFrom } from "nish/threads";

const cube = (i: i32): i64 => toI64(i) * toI64(i) * toI64(i);

export const main = (): i32 => {
  const squares = parallelFrom(6, (i) => i * i);
  const cubes = parallelFrom(4, cube);
  const none = parallelFrom(0, (i) => i);
  console.log(`${squares.length} ${squares[5]} ${cubes[3]} ${none.length}`);
  return 0;
};
