import { parallelMapInto } from "nish/threads";
const f = (t: i32[], n: i32, depth: i32): i32 => {
  const src = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) src[i] = i;
  const d = new Array<i32>(n);
  d.fill(depth);
  if (depth > 0) {
    f(d, n, depth - 1);
  }
  parallelMapInto(src, d, (x) => t[(x + 1) % n] + 1);
  let s: i32 = 0;
  for (const v of d) s = (s + v) % 1000003;
  return s;
};
export const main = (): i32 => { const z = new Array<i32>(2000000); z.fill(0); console.log(`${f(z, 2000000, 2)}`); return 0; };
