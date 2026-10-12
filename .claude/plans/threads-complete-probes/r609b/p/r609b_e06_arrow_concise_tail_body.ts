import { parallelFrom } from "nish/threads";
const sq = (x: i32, k: i32): i32 => x * k % 1000;
const helper = (n: i32): i32[] => {
  const t: i32[] = [3, 5, 7];
  return parallelFrom(n, (i) => sq(i, t[i % 3]));
};
export const main = (): i32 => {
  const n: i32 = 3000000;
  const ys = helper(n);
  let s: i32 = 0;
  for (const y of ys) s = (s + y) % 1000003;
  console.log(`${s}`);
  return 0;
};
