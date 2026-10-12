import { scope, parallelFrom } from "nish/threads";
const work = (x: i32): i32 => x * 2;
export const main = (): i32 => {
  const done: i32[] = [0, 0];
  {
    using s = scope();
    let k: i32 = 0;
    while (k < 2) {
      const ys = parallelFrom(2, (i) => done[0] + i);
      console.log(`k=${k} ${ys[1]}`);
      s.spawn(work, 21, done, k);
      k = k + 1;
    }
  }
  console.log(`${done[0]} ${done[1]}`);
  return 0;
};
