import { parallelMap } from "nish/threads";
export const main = (): i32 => {
  const xs32: i32[] = [1, 2, 3];
  const big: i64 = 40;
  const small: i32 = 1;
  const ys = parallelMap(xs32, (x) => x + toI32(big) + small);
  console.log(`${ys[0]} ${ys[2]}`);
  return 0;
};
