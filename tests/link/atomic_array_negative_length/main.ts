// An atomic array of a negative length is refused as `new Array` of one is:
// the constructor stops the program before any buffer is allocated, and no
// line after it prints.
import { AtomicI32Array } from "nish/threads";

export const main = (): i32 => {
  const ok = new AtomicI32Array(2);
  console.log(`length ${ok.length}`);
  const n: i32 = ok.length - 3;
  const bins = new AtomicI32Array(n);
  console.log(`not reached ${bins.length}`);
  return 0;
};
