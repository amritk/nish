import { parallelFrom, parallelReduce } from "nish/threads";
export const main = (): i32 => {
  const k: i64 = toI64(3);
  const xs = parallelFrom(10, (i) => toI64(i) * k);
  const s = parallelReduce(xs, (a, b) => a + b, toI64(0));
  console.log(`${s}`);
  return 0;
};
