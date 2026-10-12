import { parallelFrom, scope } from "nish/threads";
const work = (n: i32): i32 => n * 2;
export const main = (): i32 => {
  const sums: i32[] = [0, 0];
  {
    using s = scope();
    s.spawn(work, 21, sums, 0);
    s.spawn(work, 50, sums, 1);
    const ys = parallelFrom(3000000, (i) => (sums[0] + sums[1]) * 3 + (i % 1000));
    let t: i32 = 0;
    for (const y of ys) t = (t + y) % 1000003;
    console.log(`in block: ${t}`);
  }
  console.log(`after: ${sums[0]} ${sums[1]}`);
  return 0;
};
