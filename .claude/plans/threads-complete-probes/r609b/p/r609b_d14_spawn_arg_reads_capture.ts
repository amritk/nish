import { scope, parallelFrom } from "nish/threads";
const work = (x: i32): i32 => x * 2;
export const main = (): i32 => {
  const done: i32[] = [0, 0];
  {
    using s = scope();
    s.spawn(work, 21, done, 0);
    s.spawn(work, parallelFrom(1, (i) => done[0] + i)[0], done, 1);
  }
  console.log(`${done[0]} ${done[1]}`);
  return 0;
};
