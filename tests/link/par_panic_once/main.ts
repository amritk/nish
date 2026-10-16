// Every chunk of a parallel map panics, on as many threads as the pool has:
// only the first panic prints its message and exits (`nish_panic_claim`,
// runtime/runtime.c), so stderr holds exactly one line, whichever chunk won.
import { parallelMapInto } from "nish/threads";

const check = (x: i32): i32 => {
  if (x % 50000 === 0) {
    panic("an element failed");
  }
  return x + 1;
};

export const main = (): i32 => {
  const n = 400000;
  const src = new Array<i32>(n);
  for (let i = 0; i < n; i++) {
    src[i] = i;
  }
  const dst = new Array<i32>(n);
  parallelMapInto(src, dst, check);
  console.log(`${dst[1]}`);
  return 0;
};
