// NL2739: a function that takes a `MutexGuard` named as a value.
import { MutexGuard } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const bump = (g: MutexGuard<Counter>): void => {
  g.value.n = g.value.n + 1;
};

export const main = (): i32 => {
  const f = bump;
  return f === bump ? 0 : 1;
};
