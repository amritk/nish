// NL2734: a reference passed where a function parameter of `parallelMap` is.
// An ordinary function takes a reference as the arrow that calls it; what runs
// on other threads takes only a function or an arrow named at the call.
import { parallelMap } from "nish/threads";

type F = (x: i32) => i32;
const double = (x: i32): i32 => x * 2;

export const main = (): i32 => {
  const h: F = double;
  return parallelMap([1, 2], h).length;
};
