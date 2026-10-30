// `load…` and `store` move a whole vector between an array and a register
// with one bounds check, and the element at each lane's position is the lane.
import { u8x16, loadU8x16, loadI32x4, loadF64x2, store, extract, replace } from "nish:simd";

export const main = (): number => {
  const bytes: u8[] = [];
  for (let i = 0; i < 20; i++) {
    bytes.push(toU8(i * 3));
  }
  const b = loadU8x16(bytes, 2);
  console.log(extract(b, 0));
  console.log(extract(b, 15));
  store(u8x16(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 255), bytes, 4);
  console.log(bytes[3]);
  console.log(bytes[4]);
  console.log(bytes[19]);
  const words: i32[] = [1, 2, 3, 4, 5, 6];
  const w = replace(loadI32x4(words, 2), 3, 100);
  store(w, words, 0);
  console.log(words[0] + words[3] + words[5]);
  const xs: f64[] = [0.5, 1.5];
  console.log(extract(loadF64x2(xs, 0), 1));
  return 0;
};
