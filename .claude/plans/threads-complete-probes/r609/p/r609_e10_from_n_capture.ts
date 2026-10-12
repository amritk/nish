import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  const n: i32 = 2500000;
  const ys = parallelFrom(n, (i) => n - i);
  console.log(`${ys.length} ${ys[0]} ${ys[n - 1]}`);
  return 0;
};
