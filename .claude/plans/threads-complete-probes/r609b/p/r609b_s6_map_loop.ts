import { scope, parallelMap } from "nish/threads";
const work = (x: i32): i32 => x * 2;
export const main = (): i32 => {
  const done: i32[] = [0, 0];
  const xs: i32[] = [1, 2, 3];
  {
    using s = scope();
    for (let k: i32 = 0; k < 2; k++) {
      const r = parallelMap(xs, (x) => x + done[0])[2];
      console.log(`k=${k} ${r}`);
      s.spawn(work, 21, done, k);
    }
  }
  console.log(`after: ${done[0]} ${done[1]}`);
  return 0;
};
