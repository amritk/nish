import { parallelMapInto } from "nish/threads";
interface Cfg { scale: i32; lut: i32[]; }
export const main = (): i32 => {
  const n: i32 = 3000000;
  const cfg: Cfg = { scale: 3, lut: [1, 4, 9, 16] };
  const src = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) src[i] = i;
  const d = new Array<i32>(n);
  parallelMapInto(src, d, (x) => cfg.scale * cfg.lut[x % 4]);
  let s: i32 = 0;
  for (const v of d) s = (s + v) % 1000003;
  console.log(`${s}`);
  return 0;
};
