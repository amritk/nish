// A `parallelMapInto` body answers a `string` or a scalar array, not an array
// of arrays of strings: the join's copy of each element follows no pointer in it.
import { parallelMapInto } from "nish/threads";

export const main = (): i32 => {
  const rows: string[][][] = [[], [], []];
  parallelMapInto([1, 2, 3], rows, (x): string[][] => [[`r${x}`]]);
  return rows.length;
};
