import { parallelFrom } from "nish/threads";
const sq = (x: i32): i32 => x * x;
export const main = (): i32 => {
  const base: i32 = 10;
  const ys = parallelFrom(4, (i) => sq(i) + base);
  const zs = parallelFrom(4, (base) => base * 2);
  console.log(`${ys[3]} ${zs[3]} ${base}`);
  return 0;
};
