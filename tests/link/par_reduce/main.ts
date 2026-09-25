// WP29 P1: `parallelReduce` from `nish/threads`, and why it is deterministic.
// The input is split into min(64, ceil(n / 2^20)) blocks, each folded from the
// identity, and the block results are combined left to right. Three million
// elements is three blocks, and the f64 sum below is the same bits on one core
// or sixty-four, run twice, and written out by hand.
import { parallelReduce } from "nish/threads";

// A named function is opaque to the operator rule: associativity is its
// author's promise (docs/LANGUAGE.md, "Data parallelism").
const add = (a: i32, b: i32): i32 => a + b;

/** The three blocks of three million elements, folded as `parallelReduce` folds them. */
const blocked = (xs: f64[]): f64 => {
  const partials: f64[] = [0.0, 0.0, 0.0];
  for (let k: i32 = 0; k < 3; k++) {
    for (let i: i32 = k * 1000000; i < (k + 1) * 1000000 && i < toI32(xs.length); i++) {
      if (i >= 0) {
        partials[k] = partials[k] + xs[i];
      }
    }
  }
  return partials[0] + partials[1] + partials[2];
};

export const main = (): i32 => {
  const small: i32[] = [1, 2, 3, 4];
  const empty: i32[] = [];
  console.log(`${parallelReduce(small, add, 0)} ${parallelReduce(small, (a, b) => a * b, 1)} ${parallelReduce(empty, add, 0)}`);
  const n: i32 = 3000000;
  const xs = new Array<f64>(n);
  const ys = new Array<i32>(n);
  for (let i: i32 = 0; i < toI32(xs.length) && i < toI32(ys.length); i++) {
    ys[i] = i % 10;
    // `toF64` is a call, and a call ends the length fact the loop test gave.
    const x = 1.0 / toF64(i + 1);
    if (i < toI32(xs.length)) {
      xs[i] = x;
    }
  }
  const once = parallelReduce(xs, (a, b) => a + b, 0.0);
  const twice = parallelReduce(xs, (a, b) => a + b, 0.0);
  const bits = f64ToBits(once);
  console.log(`${bits} ${bits === f64ToBits(twice)} ${bits === f64ToBits(blocked(xs))}`);
  console.log(`${parallelReduce(ys, add, 0)} ${parallelReduce(ys, (a: i32, b: i32): i32 => a | b, 0)}`);
  return 0;
};
