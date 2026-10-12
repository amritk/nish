import { parallelMapInto } from "nish/threads";
const f = (table: i32[]): i32 => {
  const src: i32[] = [0, 1, 2];
  const dst: i32[] = [0, 0, 0];
  parallelMapInto(src, dst, (x) => table[x] * 2);
  return dst[2];
};
export const main = (): i32 => { console.log(`${f([5, 6, 7])}`); return 0; };
