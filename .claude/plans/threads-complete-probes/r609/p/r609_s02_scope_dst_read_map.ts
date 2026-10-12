import { parallelMap, scope } from "nish/threads";
const work = (n: i32): i32 => n * 2;
export const main = (): i32 => {
  const sums: i32[] = [0, 0];
  const xs: i32[] = [1, 2, 3];
  const keep: i32[] = [0];
  {
    using s = scope();
    s.spawn(work, 21, sums, 0);
    const ys = parallelMap(xs, (x) => sums[0] * x);
    keep[0] = ys[2];
  }
  console.log(`${keep[0]} ${sums[0]}`);
  return 0;
};
