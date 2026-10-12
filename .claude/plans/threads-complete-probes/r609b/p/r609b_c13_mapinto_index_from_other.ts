import { parallelMapInto } from "nish/threads";
const run = (n: i32): i32 => {
  const idx = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) idx[i] = i;
  const small = new Array<i32>(n - 1);
  small.fill(2);
  const d = new Array<i32>(n);
  parallelMapInto(idx, d, (x) => small[x]);
  return d[n - 1];
};
export const main = (): i32 => { console.log(`${run(10)}`); return 0; };
