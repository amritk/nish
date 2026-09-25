// A parallel body answers a number, a `boolean` or an enum: a string made on a
// worker thread would be in an arena freed when that thread exits.
import { parallelMapInto } from "nish/threads";

const name = (x: i32): string => "n";

export const main = (): i32 => {
  const out: string[] = ["", ""];
  parallelMapInto([1, 2], out, name);
  return 0;
};
