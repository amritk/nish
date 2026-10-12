import { parallelFrom } from "nish/threads";
const run = (n: i32): i32 => {
  const a = new Array<i32>(n);
  const b = new Array<i32>(n - 2);
  b.fill(4);
  const m = a.length;
  const ys = parallelFrom(m, (i) => b[i]);
  return ys[m - 1];
};
export const main = (): i32 => { console.log(`${run(10)}`); return 0; };
