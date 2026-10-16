// #618: a private function named after a libm function is `internal`, so it
// binds nothing outside its module, but LLVM knows `floor`, `sqrt` and `sin` by
// name and folds a call to one with a constant argument as the C library's:
// natively `floor(1.5)` printed 1 where Node printed 42. An internal function
// whose name is reserved to C takes a `$` (`@floor$`), which LLVM does not
// recognise, so the program prints what Node prints. `abs`, `atan` and `labs`
// are names LLVM's TargetLibraryInfo knows (`llvm-tli-checker`) beyond libm's
// own list, called with a constant and, for `abs`, a value only known at run
// time.
import { doubled } from "./base.ts";

const floor = (x: f64): f64 => x + 40.5;

const sqrt = (x: f64): f64 => x * 10.75;

const sin = (x: f64): f64 => x + 44;

const abs = (x: i32): i32 => x * 2;

const atan = (x: f64): f64 => x + 1;

const labs = (x: i64): i64 => x - 1;

export const main = (): i32 => {
  const n: i32 = process.argv.length < 100 ? -5 : 5;
  console.log(`${floor(1.5)} ${sqrt(4)} ${sin(0)} ${doubled(21)}`);
  console.log(`${abs(-3)} ${abs(n)} ${atan(1)} ${labs(-7)}`);
  return 0;
};
