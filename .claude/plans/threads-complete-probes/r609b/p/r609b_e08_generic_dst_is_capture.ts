import { parallelMapInto } from "nish/threads";
const g = <T>(tag: T[], n: i32): i32 => {
  const src = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) src[i] = i;
  const d = new Array<i32>(n);
  d.fill(1);
  const t = d;
  parallelMapInto(src, d, (x) => t[(x + 1) % n] + toI32(tag.length));
  let s: i32 = 0;
  for (const v of d) s = (s + v) % 1000003;
  return s;
};
export const main = (): i32 => {
  const a: f64[] = [1.0];
  const b: string[] = ["x", "y"];
  console.log(`${g(a, 3000000)} ${g(b, 3000000)}`);
  return 0;
};
