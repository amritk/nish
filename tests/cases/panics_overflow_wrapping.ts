// panics_overflow under the deprecated `--wrapping` (see .args): every signed
// operation of the entry package wraps, with no check, so none is an
// `overflow` site.
import { wrappingAdd } from "nish:unsafe";

class Counter {
  n: i32;
  constructor() {
    this.n = 0;
  }
}

const sum = (a: i32, b: i32): i32 => a + b;

const scaled = (a: i64, b: i64): i64 => -(a * b);

const bump = (c: Counter, xs: i32[], k: i32): void => {
  c.n += k;
  xs[0] -= k;
};

const hash = (a: u32, b: u32): u32 => a * 31 + b;

const wrapped = (a: i32, b: i32): i32 => wrappingAdd(a, b);

export const main = (): number => {
  const k: i32 = process.argv.length;
  const c = new Counter();
  const xs: i32[] = [10];
  bump(c, xs, k);
  console.log(sum(k, k));
  console.log(scaled(toI64(k), toI64(3)));
  console.log(c.n + xs[0]);
  console.log(hash(toU32(k), toU32(7)));
  console.log(wrapped(k, 2147483647));
  return 0;
};
