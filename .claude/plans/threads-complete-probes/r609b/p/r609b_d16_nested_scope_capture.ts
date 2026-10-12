import { scope, parallelFrom } from "nish/threads";
const work = (x: i32): i32 => x * 2;
export const main = (): i32 => {
  const done: i32[] = [0];
  const other: i32[] = [0];
  {
    using s = scope();
    s.spawn(work, 21, done, 0);
    {
      using s2 = scope();
      s2.spawn(work, 1, other, 0);
    }
    const ys = parallelFrom(2, (i) => done[0] + other[0] + i);
    console.log(`${ys[1]}`);
  }
  console.log(`${done[0]}`);
  return 0;
};
