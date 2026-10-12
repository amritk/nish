import { scope, parallelFrom } from "nish/threads";
const work = (x: i32): i32 => x * 2;
export const main = (): i32 => {
  const done: i32[] = [0];
  const a = done;
  {
    using s = scope();
    s.spawn(work, 21, done, 0);
    const ys = parallelFrom(3, (i) => a[0] + i);
    console.log(`${ys[2]}`);
  }
  console.log(`${done[0]}`);
  return 0;
};
