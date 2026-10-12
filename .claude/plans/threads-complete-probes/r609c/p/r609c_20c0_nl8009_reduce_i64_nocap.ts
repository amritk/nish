import { parallelReduce } from "nish/threads";
export const main = (): i32 => {
  const xs64: i64[] = [1, 2, 3, 4];
  const k: i32 = 3;
  const m = parallelReduce(xs64, (a, x) => (a > x ? a : x) > 3 ? (a > x ? a : x) : 3, 0);
  console.log(`${m} ${k}`);
  return 0;
};
