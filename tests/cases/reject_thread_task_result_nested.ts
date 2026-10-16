// A task answers a scalar array, which the join copies whole, but not an
// array of arrays: its elements are pointers into the worker's arena, which
// the copy of the outer array would leave the parent pointing at once
// `churn()` reuses that memory.
import { scope } from "nish/threads";

const churn = (): i32 => {
  let t = 0;
  for (let i = 0; i < 4000; i++) {
    t = t + `zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz${i}`.length;
  }
  return t;
};

const grid = (n: i32): i32[][] => [[n], [n + 1]];

export const main = (): i32 => {
  const out: i32[][][] = [[]];
  {
    using s = scope();
    s.spawn(grid, 3, out, 0);
  }
  churn();
  return out[0][1][0];
};
