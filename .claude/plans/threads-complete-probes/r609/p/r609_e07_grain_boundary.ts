import { parallelFrom, parallelReduce } from "nish/threads";
const check = (n: i32, k: i32): i32 => {
  const ys = parallelFrom(n, (i) => (i * k) % 1000);
  const s = parallelReduce(ys, (a, b) => a + b, 0);
  return s % 1000003 + ys[n - 1];
};
export const main = (): i32 => {
  console.log(`${check(699049, 7)} ${check(699050, 7)} ${check(699051, 7)} ${check(1398100, 7)} ${check(1398101, 7)} ${check(1398102, 7)} ${check(2796203, 7)}`);
  return 0;
};
