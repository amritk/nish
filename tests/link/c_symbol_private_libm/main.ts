// #618: a private function named after a libm function is `internal`, so it
// binds nothing outside its module, but LLVM knows `floor`, `sqrt` and `sin` by
// name and folds a call to one with a constant argument as the C library's:
// natively `floor(1.5)` printed 1 where Node printed 42. An internal function
// whose name is reserved to C takes a `$` (`@floor$`), which LLVM does not
// recognise, so the program prints what Node prints.
import { doubled } from "./base.ts";

const floor = (x: f64): f64 => x + 40.5;

const sqrt = (x: f64): f64 => x * 10.75;

const sin = (x: f64): f64 => x + 44;

export const main = (): i32 => {
  console.log(`${floor(1.5)} ${sqrt(4)} ${sin(0)} ${doubled(21)}`);
  return 0;
};
