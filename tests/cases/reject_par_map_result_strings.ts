// A `parallelMap` body answers a `string` or a scalar array, not an array
// of strings: each element would keep a pointer into the worker's arena,
// which the join's copy of the element does not follow.
import { parallelMap } from "nish/threads";

const churn = (): i32 => {
  let t = 0;
  for (let i = 0; i < 4000; i++) {
    t = t + `zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz${i}`.length;
  }
  return t;
};

export const main = (): i32 => {
  const rows = parallelMap([1, 2, 3], (x): string[] => [`r${x}`]);
  churn();
  return rows[2][0].length;
};
