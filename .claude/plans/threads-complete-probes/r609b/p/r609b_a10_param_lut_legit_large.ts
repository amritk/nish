import { parallelMapInto } from "nish/threads";
const f = (lut: i32[], n: i32): i32 => {
  const src = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) src[i] = i % 256;
  const d = new Array<i32>(n);
  parallelMapInto(src, d, (x) => lut[x] * 3 + lut[(x + 7) % 256]);
  let s: i32 = 0;
  for (const v of d) s = (s + v) % 1000003;
  return s;
};
export const main = (): i32 => {
  const lut = new Array<i32>(256);
  for (let i: i32 = 0; i < 256; i++) lut[i] = (i * 37) % 101;
  console.log(`${f(lut, 3000000)}`);
  return 0;
};
