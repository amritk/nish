import { parallelMapInto } from "nish/threads";
export const main = (): i32 => {
  const n: i32 = 3000000;
  const xs = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) xs[i] = i;
  const d = new Array<i32>(n);
  d.fill(1);
  const e = d;
  parallelMapInto(xs, d, (x) => e[(x + 1) % n] + 1);
  let s: i32 = 0;
  for (const v of d) s = (s + v) % 1000003;
  console.log(`${s} ${e[0]}`);
  return 0;
};
