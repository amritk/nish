import { parallelMap } from "nish/threads";
export const main = (): i32 => {
  const m: i32 = 3;
  {
    let m: i32 = 5;
    m = m + 1;
    const ys = parallelMap([1, 2], (x) => x * m);
    console.log(`${ys[1]}`);
  }
  return m;
};
