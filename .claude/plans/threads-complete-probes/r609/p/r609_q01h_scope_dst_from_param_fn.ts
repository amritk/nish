import { scope, parallelFrom } from "nish/threads";
const work = (x: i32): i32 => x * 2;
const peek = (d: i32[], k: i32): i32 => parallelFrom(1, (i) => d[i] + k)[0];
export const main = (): i32 => {
  const done: i32[] = [0];
  { using s = scope(); s.spawn(work, 21, done, 0); console.log(`${peek(done, 1)}`); }
  console.log(`${done[0]}`); return 0;
};
