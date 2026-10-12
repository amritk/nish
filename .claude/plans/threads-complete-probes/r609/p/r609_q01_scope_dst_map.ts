import { scope, parallelMap } from "nish/threads";
const work = (x: i32): i32 => x * 2;
export const main = (): i32 => {
  const done: i32[] = [0]; const xs: i32[] = [1]; let r = 0;
  { using s = scope(); s.spawn(work, 21, done, 0); const ys = parallelMap(xs, (x) => done[0] + x); r = ys[0]; }
  console.log(`${r}`); return 0;
};
