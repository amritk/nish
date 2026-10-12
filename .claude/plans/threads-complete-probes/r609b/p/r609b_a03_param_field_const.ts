import { parallelMapInto } from "nish/threads";
class Holder { arr: i32[]; constructor(a: i32[]) { this.arr = a; } }
const f = (p: Holder, n: i32): i32 => {
  const src = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) src[i] = i;
  const d = new Array<i32>(n);
  d.fill(1);
  p.arr = d;
  const t = p.arr;
  parallelMapInto(src, d, (x) => t[(x + 1) % n] + 1);
  let s: i32 = 0;
  for (const v of d) s = (s + v) % 1000003;
  return s;
};
export const main = (): i32 => { console.log(`${f(new Holder([0]), 3000000)}`); return 0; };
