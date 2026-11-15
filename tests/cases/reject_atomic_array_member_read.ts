// R1: an atomic array's elements are read only through `load(i)`; a plain
// read of its buffer would race with a task's update.
import { AtomicI32Array } from "nish/threads";
export const main = (): i32 => {
  const a = new AtomicI32Array(4);
  a.add(1, 1);
  return a.values[1];
};
