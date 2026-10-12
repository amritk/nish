import { scope, parallelFrom } from "nish/threads";
const work = (x: i32): i32 => x * 2;
const run = (b: boolean): i32 => {
  const done: i32[] = [0];
  let r: i32 = 0;
  {
    using s = scope();
    if (b) {
      s.spawn(work, 21, done, 0);
    }
    r = parallelFrom(3, (i) => done[0] + i)[2];
  }
  return r * 1000 + done[0];
};
export const main = (): i32 => { console.log(`${run(true)}`); return 0; };
