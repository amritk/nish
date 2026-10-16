// A parallel body answers a number, a `boolean`, an enum, a `string` or a
// scalar array: an array of strings made on a worker thread would hold pointers
// into an arena freed when that thread exits, which the join does not copy.
import { parallelMapInto } from "nish/threads";

const name = (x: i32): string[] => ["n"];

export const main = (): i32 => {
  const out: string[][] = [[], []];
  parallelMapInto([1, 2], out, name);
  return 0;
};
