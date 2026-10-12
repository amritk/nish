import { parallelMap } from "nish/threads";
const twice = (x: i32): i32 => x * 2;
const apply = (xs: i32[], f: (x: i32) => i32, k: i32): i32[] => parallelMap(xs, (x) => f(x) + k);
export const main = (): i32 => {
  console.log(`${apply([1, 2, 3], twice, 1)[2]}`);
  return 0;
};
