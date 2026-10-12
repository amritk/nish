import { parallelMap, scope } from "nish/threads";
const work = (n: i32): i32 => n * 2;
export const main = (): i32 => {
  const sums: i32[] = [0];
  const xs: i32[] = [1, 2, 3];
  {
    using s = scope();
    s.spawn(work, 21, sums, 0);
    const ys = parallelMap(xs, (x) => x * 2);
    console.log(`in block: ${ys[2]}`);
  }
  console.log(`after: ${sums[0]}`);
  return 0;
};
