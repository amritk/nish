import { parallelMapInto } from "nish/threads";
export const main = (): i32 => {
  const n: i32 = 3000000;
  const a = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) a[i] = i;
  const b = new Array<i32>(n);
  b.fill(0);
  parallelMapInto(a, a, (x) => (x === 0 ? 1 : (b[x - 1] % 1000) + 1));
  let s: f64 = 0.0;
  for (const y of a) s = s + toF64(y);
  console.log(`${s}`);
  return 0;
};
