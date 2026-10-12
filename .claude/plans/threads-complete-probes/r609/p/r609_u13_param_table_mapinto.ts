import { parallelMapInto } from "nish/threads";
const remap = (src: i32[], lut: i32[]): i32[] => {
  const out = new Array<i32>(src.length);
  parallelMapInto(src, out, (x) => lut[x]);
  return out;
};
export const main = (): i32 => {
  const r = remap([0, 2, 1], [7, 8, 9]);
  console.log(`${r[0]} ${r[1]} ${r[2]}`);
  return 0;
};
