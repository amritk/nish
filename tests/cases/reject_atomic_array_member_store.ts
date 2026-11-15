// R1: an atomic array's buffer is written only through its methods; a plain
// store of an element races.
import { AtomicI64Array } from "nish/threads";
export const main = (): i32 => {
  const a = new AtomicI64Array(4);
  a.values[2] = 3;
  return a.length;
};
