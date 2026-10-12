import { parallelMapInto } from "nish/threads";
const g = <T>(t: T[], n: i32, z: T): i32 => {
  const src = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) src[i] = i;
  const d = new Array<T>(n);
  d.fill(z);
  parallelMapInto(src, d, (x) => t[(x + 1) % n]);
  return toI32(d.length);
};
export const main = (): i32 => {
  const a = new Array<i32>(3000000);
  a.fill(4);
  console.log(`${g(a, 3000000, 0)}`);
  return 0;
};
