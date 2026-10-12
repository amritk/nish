import { parallelMapInto } from "nish/threads";
const g = <T>(tag: T[], t: i32[], n: i32): i32 => {
  const src = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) src[i] = i;
  const d = new Array<i32>(n);
  parallelMapInto(src, d, (x) => t[x % 3] + toI32(tag.length));
  let s: i32 = 0;
  for (const v of d) s = (s + v) % 1000003;
  return s;
};
export const main = (): i32 => {
  const t: i32[] = [1, 2, 3];
  const a: f64[] = [1.0];
  const b: string[] = ["x", "y"];
  console.log(`${g(a, t, 3000000)} ${g(b, t, 3000000)}`);
  return 0;
};
