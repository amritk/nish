import { parallelMapInto } from "nish/threads";
const f = (t: i32[], n: i32, flag: boolean): i32 => {
  const src = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) src[i] = i;
  const d = new Array<i32>(n);
  d.fill(1);
  const u = flag ? d : t;
  parallelMapInto(src, d, (x) => u[(x + 1) % n] + t[0]);
  let s: i32 = 0;
  for (const v of d) s = (s + v) % 1000003;
  return s;
};
export const main = (): i32 => { const a: i32[] = [1]; console.log(`${f(a, 3000000, true)}`); return 0; };
