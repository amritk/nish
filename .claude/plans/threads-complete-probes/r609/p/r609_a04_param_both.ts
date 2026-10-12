import { parallelMapInto } from "nish/threads";
const run = (xs: i32[], dst: i32[]): void => {
  parallelMapInto(xs, dst, (x) => (x === 0 ? 1 : (xs[x - 1] % 1000) + 1));
};
export const main = (): i32 => {
  const n: i32 = 3000000;
  const a = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) a[i] = i;
  run(a, a);
  let s: f64 = 0.0;
  for (const y of a) s = s + toF64(y);
  console.log(`${s}`);
  return 0;
};
