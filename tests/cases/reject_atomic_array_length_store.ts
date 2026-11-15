// An atomic array's length is fixed when it is made.
import { AtomicI32Array } from "nish/threads";
export const main = (): i32 => {
  const a = new AtomicI32Array(4);
  a.length = 8;
  return a.load(0);
};
