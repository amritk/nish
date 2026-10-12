import { parallelFrom, scope } from "nish/threads";
const work = (n: i32): i32 => n * 2;
export const main = (): i32 => {
  const sums: i32[] = [0];
  {
    using s = scope();
    s.spawn(work, 21, sums, 0);
    const ys = parallelFrom(3, (i) => sums[0] + i);
    console.log(`in block: ${ys[2]}`);
  }
  console.log(`after: ${sums[0]}`);
  return 0;
};
