import { scope, parallelFrom } from "nish/threads";
const work = (x: i32): i32 => x * 2;
export const main = (): i32 => {
  const done: i32[] = [0, 0, 0];
  {
    using s = scope();
    for (let k: i32 = 0; k < 3; k++) {
      const ys = parallelFrom(3, (i) => done[0] + done[1] + i);
      console.log(`k=${k} ${ys[2]}`);
      s.spawn(work, 21 + k, done, k);
    }
  }
  console.log(`${done[0]} ${done[1]} ${done[2]}`);
  return 0;
};
