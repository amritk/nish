import { parallelReduce, scope } from "nish/threads";
const work = (n: i32): i32 => n * 2;
export const main = (): i32 => {
  const sums: i32[] = [0];
  const xs: i32[] = [1, 2, 3];
  {
    using s = scope();
    s.spawn(work, 21, sums, 0);
    const total = parallelReduce(xs, (a, b) => a + b, 0);
    console.log(`in block: ${total}`);
  }
  console.log(`after: ${sums[0]}`);
  return 0;
};
