import { scope, parallelReduce } from "nish/threads";
const work = (x: i32): i32 => x * 2;
export const main = (): i32 => {
  const done: i32[] = [0, 0, 0];
  const xs: i32[] = [1, 2, 3];
  {
    using s = scope();
    for (let k: i32 = 0; k < 3; k++) {
      const r = parallelReduce(xs, (a, b) => a + b + done[0], 0);
      console.log(`k=${k} ${r}`);
      s.spawn(work, 21 + k, done, k);
    }
  }
  console.log(`${done[0]}`);
  return 0;
};
