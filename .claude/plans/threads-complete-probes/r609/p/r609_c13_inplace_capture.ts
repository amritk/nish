import { parallelMapInto } from "nish/threads";
export const main = (): i32 => {
  const n: i32 = 3000000;
  const a = new Int32Array(n);
  for (let i: i32 = 0; i < n; i++) a[i] = i % 1000;
  const tab = new Int32Array(1000);
  for (let i: i32 = 0; i < 1000; i++) tab[i] = (i * 7) % 13;
  parallelMapInto(a, a, (x) => tab[x] + x);
  let s: i32 = 0;
  for (const y of a) s = (s + y) % 1000003;
  console.log(`${s}`);
  return 0;
};
