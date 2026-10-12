import { parallelMapInto } from "nish/threads";
const g = <T>(z: T, n: i32): T => {
  const src = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) src[i] = i;
  const t = new Array<T>(n);
  t.fill(z);
  const d = new Array<T>(n);
  parallelMapInto(src, d, (x) => t[(x + 1) % n]);
  return d[5];
};
export const main = (): i32 => { console.log(`${g(7, 3000000)} ${g(toF64(5) / toF64(2), 3000000)}`); return 0; };
