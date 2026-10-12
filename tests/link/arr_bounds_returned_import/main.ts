// A helper from another module that hands its array to a function gives no
// length: the call in its body is resolved only in the caller's own module.
// `xs[3]` keeps its check (`arr_bounds_returned_import` in tests/run.js).
import { filledFour } from "./lib";

export const main = (): number => {
  const xs = filledFour();
  console.log(`${xs[3]}`);
  return 0;
};
