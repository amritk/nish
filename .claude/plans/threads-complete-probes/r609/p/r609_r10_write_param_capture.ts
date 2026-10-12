import { parallelMap } from "nish/threads";
const f = (xs: i32[], k: i32): i32[] =>
  parallelMap(xs, (x): i32 => {
    k = k + x;
    return k;
  });
export const main = (): i32 => {
  console.log(`${f([1, 2, 3], 1)[2]}`);
  return 0;
};
