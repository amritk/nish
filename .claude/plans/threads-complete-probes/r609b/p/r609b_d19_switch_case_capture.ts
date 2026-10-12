import { scope, parallelFrom } from "nish/threads";
const work = (x: i32): i32 => x * 2;
const run = (k: i32): i32 => {
  const done: i32[] = [0];
  let r: i32 = 0;
  {
    using s = scope();
    s.spawn(work, 21, done, 0);
    switch (k) {
      case 1:
        r = parallelFrom(1, (i) => done[0] + i)[0];
        break;
      default:
        r = -1;
    }
  }
  return r;
};
export const main = (): i32 => { console.log(`${run(1)}`); return 0; };
