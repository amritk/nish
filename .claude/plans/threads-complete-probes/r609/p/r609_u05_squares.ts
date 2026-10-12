import { parallelFrom, parallelReduce } from "nish/threads";
export const main = (): i32 => {
  const n: i32 = 1000;
  const sq = parallelFrom(n, (i) => toF64(i) * toF64(i));
  const total = parallelReduce(sq, (a, b) => a + b, 0.0);
  console.log(`${sq[999]} ${total}`);
  return 0;
};
