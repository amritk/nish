import { parallelMapInto, scope } from "nish/threads";
const work = (n: i32): i32 => n * 2;
const dbl = (x: i32): i32 => x * 2;
export const main = (): i32 => {
  const sums: i32[] = [0];
  const xs: i32[] = [1, 2, 3];
  const dst: i32[] = [0, 0, 0];
  {
    using s = scope();
    s.spawn(work, 21, sums, 0);
    parallelMapInto(xs, dst, dbl);
    console.log(`in block: ${dst[2]}`);
  }
  console.log(`after: ${sums[0]}`);
  return 0;
};
