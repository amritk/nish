import { parallelReduce, scope } from "nish/threads";
const work = (n: i32): i32 => n * 2;
const run = (): i32 => {
  const sums: i32[] = [0];
  const xs: i32[] = [1, 2, 3];
  using s = scope();
  s.spawn(work, 21, sums, 0);
  const total = parallelReduce(xs, (a, b) => a + b, 0);
  const ys = parallelReduce(xs, (a, b) => a + b + sums[0] * 0, 0);
  console.log(`mid ${total} ${ys}`);
  return sums[0];
};
export const main = (): i32 => {
  console.log(`${run()}`);
  return 0;
};
