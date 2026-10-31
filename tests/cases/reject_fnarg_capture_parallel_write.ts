// An arrow handed on to `parallelMap` is checked by the parallel rules where
// it runs: a push onto a captured array would race.
import { parallelMap } from "nish/threads";
const each = (xs: i32[], f: (x: i32) => i32): i32[] => parallelMap(xs, f);
export const main = (): i32 => {
  const seen: i32[] = [];
  const ys = each([1, 2, 3], (x) => {
    seen.push(x);
    return x * 2;
  });
  return ys[0] + seen.length;
};
