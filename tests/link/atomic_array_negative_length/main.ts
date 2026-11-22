// An atomic array of a negative length is an array of none: the constructor
// allocates no buffer and does not stop the program, and every index of it
// would.
import { AtomicI32Array } from "nish/threads";

export const main = (): i32 => {
  const ok = new AtomicI32Array(2);
  console.log(`length ${ok.length}`);
  const n: i32 = ok.length - 3;
  const bins = new AtomicI32Array(n);
  console.log(`empty ${bins.length}`);
  return 0;
};
