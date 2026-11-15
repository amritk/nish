// A negative index into an atomic array is out of range as a negative array
// index is: element -1 of an `AtomicI64Array` stops the program with the
// out-of-range panic before anything is written, and no line after it prints.
import { AtomicI64Array } from "nish/threads";

export const main = (): i32 => {
  const totals = new AtomicI64Array(4);
  const one: i64 = 1;
  totals.add(0, one);
  console.log(`first ${totals.load(0)}`);
  const at: i32 = 0 - totals.length / 4;
  totals.add(at, one);
  console.log("not reached");
  return 0;
};
