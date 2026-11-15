// An atomic array's index is checked as an array index is: element 16 of a
// 16-element `AtomicI32Array` stops the program with the out-of-range panic
// before anything is written, and no line after it prints.
import { AtomicI32Array } from "nish/threads";

export const main = (): i32 => {
  const bins = new AtomicI32Array(16);
  bins.add(15, 1);
  console.log(`last ${bins.load(15)}`);
  const at: i32 = bins.length;
  bins.add(at, 1);
  console.log("not reached");
  return 0;
};
