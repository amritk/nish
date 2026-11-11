// WP51 stage 2: a function reference is passed for an ordinary function's
// parameter, but `parallelMap` runs its function on other threads and takes
// only a top-level function or an arrow named at the call.
import { parallelMap } from "nish/threads";
type F = (x: i32) => i32;
const double = (x: i32): i32 => x * 2;
export const main = (): i32 => {
  const h: F = double;
  return parallelMap([1, 2], h).length;
};
