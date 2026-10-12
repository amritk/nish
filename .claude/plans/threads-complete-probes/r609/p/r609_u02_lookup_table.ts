import { parallelMap } from "nish/threads";
export const main = (): i32 => {
  const gamma: u8[] = [0, 10, 40, 90, 160, 250];
  const pixels: u8[] = [0, 1, 2, 3, 4, 5, 5, 0];
  const out = parallelMap(pixels, (p) => gamma[toI32(p)]);
  console.log(`${out[0]} ${out[2]} ${out[5]} ${out[7]}`);
  return 0;
};
