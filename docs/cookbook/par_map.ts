import { parallelMapInto, parallelReduce } from "nish/threads";

const square = (x: f64): f64 => x * x;

export const sumOfSquares = (xs: f64[], scratch: f64[]): f64 => {
  parallelMapInto(xs, scratch, square);
  return parallelReduce(scratch, (a, b) => a + b, 0.0);
};
