import { parallelMap } from "nish/threads";
export const main = (): i32 => {
  const t: i32[] = [1, 2];
  const ys = parallelMap([1, 2], (x): i32 => {
    t = [x];
    return t[0];
  });
  console.log(`${ys[1]}`);
  return 0;
};
