// `parallelFrom`'s result is a number, a `boolean`, an enum, a `string` or
// a scalar array, as `parallelMap`'s is: an array of arrays would point into a
// worker's arena through its elements, which the join does not copy.
import { parallelFrom } from "nish/threads";

export const main = (): i32 => {
  const names = parallelFrom(2, (i): i32[][] => [[i]]);
  return names.length;
};
