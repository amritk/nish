import { parallelMapInto } from "nish/threads";
class Holder { arr: i32[]; constructor(a: i32[]) { this.arr = a; } }
const g = (p: Holder, d: i32[], src: i32[], n: i32): void => {
  parallelMapInto(src, d, (x) => p.arr[(x + 1) % n] + 1);
};
const f = (n: i32): i32 => {
  const src = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) src[i] = i;
  const d = new Array<i32>(n);
  d.fill(1);
  const o = new Holder(d);
  g(o, d, src, n);
  let s: i32 = 0;
  for (const v of d) s = (s + v) % 1000003;
  return s;
};
export const main = (): i32 => { console.log(`${f(3000000)}`); return 0; };
