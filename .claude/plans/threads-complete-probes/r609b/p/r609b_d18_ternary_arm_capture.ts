import { scope, parallelFrom } from "nish/threads";
const work = (x: i32): i32 => x * 2;
const run = (b: boolean): i32 => {
  const done: i32[] = [0];
  let r: i32 = 0;
  {
    using s = scope();
    s.spawn(work, 21, done, 0);
    r = b ? parallelFrom(1, (i) => done[0] + i)[0] : 0;
  }
  return r;
};
export const main = (): i32 => { console.log(`${run(true)}`); return 0; };
