import { scope, parallelFrom } from "nish/threads";
const work = (x: i32): i32 => x * 2;
export const main = (): i32 => {
  let total: i32 = 0;
  for (let k: i32 = 0; k < 3; k++) {
    const done: i32[] = [0];
    {
      using s = scope();
      const kk = k;
      const ys = parallelFrom(3, (i) => done[0] + i + kk);
      total = total + ys[2];
      s.spawn(work, 21 + k, done, 0);
    }
    total = total + done[0];
  }
  console.log(`${total}`);
  return 0;
};
