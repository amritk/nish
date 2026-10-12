import { parallelMap } from "nish/threads";
export const main = (): i32 => {
  let m: i32 = 3;
  m = m + 1;
  {
    const m: i32 = 5;
    const ys = parallelMap([1, 2], (x) => x * m);
    console.log(`${ys[1]}`);
  }
  return 0;
};
