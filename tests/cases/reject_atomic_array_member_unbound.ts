// R1: an atomic array's method is only called, never taken as a value.
import { AtomicI32Array } from "nish/threads";
export const main = (): i32 => {
  const a = new AtomicI32Array(4);
  const add = a.add;
  add(0, 1);
  return a.load(0);
};
