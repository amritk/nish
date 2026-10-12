// Probe: the cheapest map body (estimate 3) over 1,200,000 elements, between
// 2^20 and 2^22: grain 2^20/3 = 349525 divides it, 2^22/3 = 1398101 does not.
// Each round moves the input, and the output is folded into a checksum.
import { parallelMapInto } from "nish/threads";

const cheap = (x: i32): i32 => x + 1;

export const main = (): i32 => {
  const n: i32 = process.argv.length > 1 ? parseInt(process.argv[1]) : 1200000;
  const rounds: i32 = process.argv.length > 2 ? parseInt(process.argv[2]) : 20;
  const src: i32[] = new Array<i32>(n);
  const dst: i32[] = new Array<i32>(n);
  let check: i32 = 0;
  for (let r: i32 = 0; r < rounds; r++) {
    for (let i: i32 = 0; i < n; i++) {
      src[i] = (i + r * 7) & 1048575;
    }
    parallelMapInto(src, dst, cheap);
    for (let i: i32 = 0; i < n; i++) {
      check = (check * 31 + dst[i]) % 1000003;
    }
  }
  console.log(`${n} ${rounds} ${check}`);
  return 0;
};
