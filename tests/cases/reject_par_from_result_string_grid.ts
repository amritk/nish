// A `parallelFrom` body answers a `string` or a scalar array, not an array of
// arrays of strings: the join's copy of each element follows no pointer in it.
import { parallelFrom } from "nish/threads";

export const main = (): i32 => {
  const rows = parallelFrom(3, (i): string[][] => [[`r${i}`]]);
  return rows[2][0][0].length;
};
