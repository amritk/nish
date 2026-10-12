import { parallelMap } from "nish/threads";
export const main = (): i32 => {
  const k: i32 = 0;
  const ys = parallelMap([1, 2, 3], (x): i32 => {
    k += x;
    return x;
  });
  console.log(`${k} ${ys.length}`);
  return 0;
};
