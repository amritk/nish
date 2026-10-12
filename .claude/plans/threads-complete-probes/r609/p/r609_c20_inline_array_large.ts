import { parallelFrom, parallelReduce } from "nish/threads";
export const main = (): i32 => {
  const tab: i32[] = [11, 22, 33];
  const pt: f64[] = [0.5, 1.5];
  const ys = parallelFrom(3000000, (i) => (tab[1] + i) % 1000 + toI32(pt[1] * 2.0));
  const s = parallelReduce(ys, (a, b) => a + b, 0);
  console.log(`${s} ${tab[0]} ${pt[0]}`);
  return 0;
};
