// --unchecked-indexing and --wrapping reach the entry package and nothing else
// (docs/LANGUAGE.md, "nish:unsafe"). This program is compiled with both
// (`args`): its own `+` wraps without `nsw` and its own index is unchecked,
// while the dependency under node_modules/ and the `nish/text` module it
// imports keep every check and every `nsw`. tests/run.js compiles it again
// without the flags and holds both of their modules to the same bytes.
import { at, sum } from "./node_modules/checked_dep/index";
import { firstDifference } from "nish/text";

export const wrapped = (a: i32, b: i32): i32 => a + b;

export const second = (xs: i32[], i: i32): i32 => xs[i];

export const main = (): i32 => {
  const xs: i32[] = [10, 20, 30];
  console.log(wrapped(2147483647, 1));
  console.log(second(xs, 1));
  console.log(firstDifference(["a"], ["a", "b"]));
  console.log(sum(40, 2));
  console.log(at(xs, 5));
  return 0;
};
