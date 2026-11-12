// WP51 stage 2: `parallelReduce` takes no function reference.
import { parallelReduce } from "nish/threads";
type F = (a: i32, b: i32) => i32;
const add = (a: i32, b: i32): i32 => a + b;
export const main = (): i32 => {
  const h: F = add;
  return parallelReduce([1, 2], h, 0);
};
