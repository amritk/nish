import { scope, parallelReduce } from "nish/threads";
const work = (x: i32): i32 => x * 2;
export const main = (): i32 => {
  const done: i32[] = [0];
  const xs: i32[] = [1, 2, 3];
  {
    using s = scope();
    s.spawn(work, 21, done, 0);
    const r = parallelReduce(xs, (a, b) => a + b + done[0], 0);
    console.log(`in block: ${r}`);
  }
  console.log(`after: ${done[0]}`);
  return 0;
};
