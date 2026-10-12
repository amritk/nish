import { parallelFrom, parallelMapInto } from "nish/threads";
export const main = (): i32 => {
  const n: i32 = 3000000;
  const a = parallelFrom(n, (i) => i % 1000);
  const d = new Array<i32>(n);
  parallelMapInto(a, d, (x) => x * 2);
  const e = new Array<i32>(n);
  parallelMapInto(d, e, (x) => x + a[x]);
  let s: i32 = 0;
  for (const v of e) s = (s + v) % 1000003;
  console.log(`${s}`);
  return 0;
};
