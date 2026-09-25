// WP29 P1: `dst` shorter than `src` is checked once, before any element is
// written or any thread started, and panics with `std/threads.ts`'s message.
import { parallelMapInto } from "nish/threads";

export const main = (): i32 => {
  const src: i32[] = [1, 2, 3];
  const dst: i32[] = [0, 0];
  console.log("before");
  parallelMapInto(src, dst, (x) => x + 1);
  console.log("after");
  return 0;
};
