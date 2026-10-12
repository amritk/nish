import { parallelMapInto } from "nish/threads";
const id = (a: i32[]): i32[] => a;
const f = (t0: i32[], n: i32): i32 => {
  const src = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) src[i] = i;
  const d = new Array<i32>(n);
  d.fill(1);
  const t = id(d);
  parallelMapInto(src, d, (x) => t[(x + 1) % n] + t0[0]);
  let s: i32 = 0;
  for (const v of d) s = (s + v) % 1000003;
  return s;
};
export const main = (): i32 => { const a: i32[] = [1]; console.log(`${f(a, 3000000)}`); return 0; };
