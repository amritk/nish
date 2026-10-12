import { parallelFrom, parallelReduce } from "nish/threads";
export const main = (): i32 => {
  const n: i32 = 3000000;
  const tab: f64[] = [0.25, 0.5];
  const sc: f64 = 1.0;
  const big: i64 = toI64(1000000007);
  const xs = parallelFrom(n, (i) => toF64(i % 1000) * tab[i % 2]);
  const s1 = parallelReduce(xs, (a, b) => (a + b) * sc, 0.0);
  const ys = parallelFrom(n, (i) => toI64(i) * toI64(i));
  const s2 = parallelReduce(ys, (a, b) => (a + b) % big, toI64(0));
  console.log(`${s1} ${s2}`);
  return 0;
};
