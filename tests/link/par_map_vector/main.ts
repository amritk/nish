// WP29 P1, #619: `parallelMapInto`'s element loop vectorises. `mapRange` tests
// `dst`'s length in its loop condition as well as after the call to `f`, so
// once `f` is inlined LLVM drops the second test and the store is no longer
// conditional: `tests/run.js` links the modules, runs `opt -O3` and finds the
// scramble's shift as a vector `shl`. Each element is the shift-and-xor of
// bench/par-regions.ts, so the checksum below is the one Node prints too.
// 16,384 elements is more than twice the grain the compiler gives this body
// (6,831), so under NISH_NUM_THREADS=2 the map really is divided.
import { parallelMapInto } from "nish/threads";

const scramble = (x: i32): i32 => {
  let h: i32 = x;
  for (let k: i32 = 0; k < 8; k++) {
    h = h ^ (h << 5);
    h = h ^ (h >> 3);
    h = h ^ k;
  }
  return h;
};

export const main = (): i32 => {
  const n: i32 = 16384;
  const src = new Array<i32>(n);
  const dst = new Array<i32>(n);
  for (let i: i32 = 0; i < toI32(src.length); i++) {
    src[i] = i;
  }
  parallelMapInto(src, dst, scramble);
  let sum: i32 = 0;
  for (let i: i32 = 0; i < toI32(dst.length); i++) {
    sum = (sum << 1) ^ dst[i];
  }
  console.log(`${sum} ${dst[0]} ${dst[n - 1]}`);
  return 0;
};
