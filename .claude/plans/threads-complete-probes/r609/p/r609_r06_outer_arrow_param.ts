import { parallelMap } from "nish/threads";
export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  const ys = parallelMap(xs, (x) => parallelMap(xs, (y) => y + x)[0]);
  console.log(`${ys[1]}`);
  return 0;
};
