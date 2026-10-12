import { parallelMapInto } from "nish/threads";
const g = <T>(t: T[], n: i32, z: T): T => {
  const src = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) src[i] = i;
  const d = new Array<T>(n);
  parallelMapInto(src, d, (x) => t[x % 3]);
  return d[n - 1];
};
export const main = (): i32 => {
  const ti: i32[] = [1, 2, 3];
  const tf: f64[] = [1.5, 2.5, 3.5];
  console.log(`${g(ti, 3000000, 0)} ${g(tf, 3000000, 0.0)}`);
  return 0;
};
