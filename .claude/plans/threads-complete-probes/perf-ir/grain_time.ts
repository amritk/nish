// Probe (timing): `(x) => x * 3 + 1` (estimate 5) over n elements, called
// 2^28 / n times, one input element fed from an output element between calls,
// the outputs folded into a printed checksum. Under 2^20 its grain is 209,715,
// under 2^22 838,860: n = 300,000 divides on the first only, into two chunks
// of 150,000.
import { parallelMapInto } from "nish/threads";

const f = (x: i32): i32 => x * 3 + 1;

export const main = (): i32 => {
  const n: i32 = process.argv.length > 1 ? parseInt(process.argv[1]) : 300000;
  const calls: i32 = 268435456 / n | 0;
  const src: i32[] = new Array<i32>(n);
  const dst: i32[] = new Array<i32>(n);
  for (let i: i32 = 0; i < n; i++) {
    src[i] = i & 4095;
  }
  let check: i32 = 0;
  for (let c: i32 = 0; c < calls; c++) {
    parallelMapInto(src, dst, f);
    const at: i32 = (c * 7919) % n;
    src[at] = dst[(at + 1) % n] & 4095;
    check = (check * 31 + dst[at]) % 1000003;
  }
  let fold: i32 = 0;
  for (let i: i32 = 0; i < n; i++) {
    fold = (fold + dst[i]) % 1000003;
  }
  console.log(`${n} ${calls} ${check} ${fold}`);
  return 0;
};
