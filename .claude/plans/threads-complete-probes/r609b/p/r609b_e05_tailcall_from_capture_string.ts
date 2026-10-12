import { parallelFrom } from "nish/threads";
const helper = (n: i32, k: i32): i32[] => {
  const label = `label-${k}-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`;
  return parallelFrom(n, (i) => label.length + i % 7);
};
export const main = (): i32 => {
  const n: i32 = 3000000;
  const ys = helper(n, 12345);
  let s: i32 = 0;
  for (const y of ys) s = (s + y) % 1000003;
  console.log(`${s} ${ys[0]} ${ys[n - 1]}`);
  return 0;
};
