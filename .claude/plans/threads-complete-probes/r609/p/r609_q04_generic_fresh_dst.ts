import { parallelMapInto } from "nish/threads";
const g = <T>(xs: T[]): i32 => {
  const t: i32[] = [5, 6];
  const d: i32[] = [0, 0, 0];
  const src: i32[] = [1, 2, 3];
  parallelMapInto(src, d, (x) => t[0] + x + toI32(xs.length));
  return d[2];
};
export const main = (): i32 => { const a: f64[] = [1.0]; console.log(`${g(a)}`); return 0; };
