import { parallelFrom } from "nish/threads";
const helper = (n: i32): i32[] => {
  const t = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) t[i] = i % 1000;
  return parallelFrom(n, (i) => t[i] + 1);
};
export const main = (): i32 => {
  const n: i32 = 3000000;
  const ys = helper(n);
  let s: i32 = 0;
  for (const y of ys) s = (s + y) % 1000003;
  console.log(`${s} ${ys[0]} ${ys[n - 1]}`);
  return 0;
};
