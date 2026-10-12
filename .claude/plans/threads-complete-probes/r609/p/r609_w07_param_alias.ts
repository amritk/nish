import { parallelMap } from "nish/threads";
const run = (a: i32[]): i32 => {
  const b = a;
  const xs = new Array<i32>(3000000);
  const ys = parallelMap(xs, (x): i32 => {
    b[0] = b[0] + 1;
    return x;
  });
  return a[0] + ys.length;
};
export const main = (): i32 => {
  const a: i32[] = [0];
  console.log(`${run(a)}`);
  return 0;
};
