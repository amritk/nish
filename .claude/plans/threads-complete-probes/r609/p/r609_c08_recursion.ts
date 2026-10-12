import { parallelFrom, parallelReduce } from "nish/threads";
const rec = (n: i32, k: i32): i32 => {
  if (n === 0) return 0;
  const xs = parallelFrom(700000 + n * 300000, (i) => (i * k) % 1009);
  const s = parallelReduce(xs, (a, b) => a + b, 0) % 100000;
  return s + rec(n - 1, k + 1);
};
export const main = (): i32 => {
  console.log(`${rec(5, 3)}`);
  return 0;
};
