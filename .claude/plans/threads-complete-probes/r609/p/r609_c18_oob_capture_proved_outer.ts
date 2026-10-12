import { parallelFrom } from "nish/threads";
const run = (n: i32): i32 => {
  const tab = new Int32Array(n);
  tab.fill(3);
  for (let i: i32 = 0; i < n; i++) tab[i] = i;
  const ys = parallelFrom(n + 3, (i) => tab[i]);
  return ys[n + 2];
};
export const main = (): i32 => {
  console.log(`${run(10)}`);
  return 0;
};
