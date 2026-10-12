import { scope, parallelMap } from "nish/threads";
const work = (x: i32): i32 => x * 2;
export const main = (): i32 => {
  const done: i32[] = [0, 0, 0];
  const xs: i32[] = [1, 2, 3];
  {
    using s = scope();
    for (let k: i32 = 0; k < 3; k++) {
      const ys = parallelMap(xs, (x) => done[0] + x);
      console.log(`k=${k} ${ys[2]}`);
      s.spawn(work, 21 + k, done, k);
    }
  }
  console.log(`${done[0]}`);
  return 0;
};
