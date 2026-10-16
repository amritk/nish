// A task answers a `string` or a scalar array, not an array of arrays of
// strings: neither the outer copy nor a copy of each inner array would follow
// the strings, which would keep their pointers into the worker's arena.
import { scope } from "nish/threads";

const table = (n: i32): string[][] => [[`a${n}`], [`b${n}`]];

export const main = (): i32 => {
  const out: string[][][] = [[]];
  {
    using s = scope();
    s.spawn(table, 3, out, 0);
  }
  return out[0][1][0].length;
};
