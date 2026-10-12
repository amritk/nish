import { parallelMap } from "nish/threads";
export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  const ys = parallelMap(xs, (x) => parallelMap([4, 5], (y) => y)[0] + x);
  console.log(`${ys[2]}`);
  return 0;
};
