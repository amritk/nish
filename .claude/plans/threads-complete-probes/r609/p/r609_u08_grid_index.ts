import { parallelFrom } from "nish/threads";
const grid = (w: i32, h: i32): i32[] => parallelFrom(w * h, (i) => (i % w) * 10 + toI32(Math.floor(toF64(i) / toF64(w))));
export const main = (): i32 => {
  const g = grid(4, 3);
  console.log(`${g.length} ${g[0]} ${g[5]} ${g[11]}`);
  return 0;
};
