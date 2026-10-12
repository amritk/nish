import { scope, parallelFrom } from "nish/threads";
const work = (x: i32): i32 => x * 2;
export const main = (): i32 => {
  const done: i32[] = [0];
  let r: i32 = 0;
  {
    using s = scope();
    for (let k: i32 = 0; k < 3; k++) {
      if (k === 1) {
        s.spawn(work, 21, done, 0);
        continue;
      }
      r = r + parallelFrom(1, (i) => done[0] + i)[0];
    }
  }
  console.log(`${r} ${done[0]}`);
  return 0;
};
