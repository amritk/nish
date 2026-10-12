import { scope, parallelMapInto } from "nish/threads";
const work = (x: i32): i32 => x * 2;
export const main = (): i32 => {
  const done: i32[] = [0, 0];
  const xs: i32[] = [1, 2, 3];
  {
    using s = scope();
    for (let k: i32 = 0; k < 2; k++) {
      const dd: i32[] = [0, 0, 0]; parallelMapInto(xs, dd, (x) => x + done[0]); const r = dd[2];
      console.log(`k=${k} ${r}`);
      s.spawn(work, 21, done, k);
    }
  }
  console.log(`after: ${done[0]} ${done[1]}`);
  return 0;
};
