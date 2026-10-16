// A `parallelMap` body answers a `string` or a scalar array, not an array of
// arrays of strings: the join's copy of each element follows no pointer in it.
import { parallelMap } from "nish/threads";

export const main = (): i32 => {
  const rows = parallelMap([1, 2, 3], (x): string[][] => [[`r${x}`]]);
  return rows[2][0][0].length;
};
