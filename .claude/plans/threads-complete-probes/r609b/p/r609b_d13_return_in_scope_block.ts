import { scope, parallelFrom } from "nish/threads";
const work = (x: i32): i32 => x * 2;
const run = (): i32 => {
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(work, 21, done, 0);
    return parallelFrom(3, (i) => done[0] + i)[2];
  }
};
export const main = (): i32 => { console.log(`${run()}`); return 0; };
