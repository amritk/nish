import { scope, parallelFrom } from "nish/threads";
const work = (x: i32): i32 => x * 2;
export const main = (): i32 => {
  const done: i32[] = [0];
  const other: i32[] = [0];
  {
    using s = scope();
    {
      using s2 = scope();
      s2.spawn(work, 1, other, 0);
    }
    const ys = parallelFrom(2, (i) => other[0] + i);
    s.spawn(work, ys[1], done, 0);
  }
  console.log(`${done[0]} ${other[0]}`);
  return 0;
};
