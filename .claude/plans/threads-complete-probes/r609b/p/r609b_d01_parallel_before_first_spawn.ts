import { scope, parallelFrom } from "nish/threads";
const work = (x: i32): i32 => x * 2;
export const main = (): i32 => {
  const done: i32[] = [0];
  {
    using s = scope();
    const ys = parallelFrom(3, (i) => done[0] + i);
    s.spawn(work, 21, done, 0);
    console.log(`${ys[2]}`);
  }
  console.log(`${done[0]}`);
  return 0;
};
