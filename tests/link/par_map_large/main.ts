// WP29 P1: a map long enough to divide. Three million elements is more than two
// chunks of the 2^20-element grain, so the region runs on up to three threads,
// each writing its own contiguous slice of `dst`; the checksum is the same
// however many there were.
import { parallelMapInto } from "nish/threads";

const mix = (x: i32): i32 => (x * 31 + 7) % 1000;

export const main = (): i32 => {
  const n: i32 = 3000000;
  const src = new Array<i32>(n);
  for (let i: i32 = 0; i < toI32(src.length); i++) {
    src[i] = i;
  }
  const dst = new Array<i32>(n);
  parallelMapInto(src, dst, mix);
  let sum: i64 = 0;
  for (let i: i32 = 0; i < toI32(dst.length); i++) {
    sum = sum + toI64(dst[i]);
  }
  console.log(`${dst[0]} ${dst[1048576]} ${dst[2999999]} ${sum}`);
  return 0;
};
