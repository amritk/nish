import { parallelMap } from "nish/threads";
export const main = (): i32 => {
  let s: i32 = 0;
  for (let i: i32 = 0; i < 3; i++) {
    const ys = parallelMap([1, 2], (x) => x * i);
    s = s + ys[1];
  }
  console.log(`${s}`);
  return 0;
};
