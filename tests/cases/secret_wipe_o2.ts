// `nish:secret`: the wipe survives `-O2` (CLAUDE.md, "Secret material in
// std/crypto"). `scratch` is a stack array whose bytes nothing reads after the
// `wipe`, which is exactly the store an optimiser deletes: its twin
// `secret_wipe_o2_plain` zeroes the same array with `fill(0)`, and `opt -O2`
// removes every store of that. Here the volatile `llvm.memset` stays, split by
// SROA into one volatile store per byte (`tests/run.js`, "nish:secret: the
// wipe survives opt -O2").
import { wipe } from "nish:secret";

const sum = (k: u8[]): i32 => {
  let t: i32 = 0;
  for (let i: i32 = 0; i < toI32(k.length); i++) {
    t = t + toI32(k[i]);
  }
  return t;
};

const work = (seed: i32): i32 => {
  const scratch: u8[] = [1, 2, 3, 4, 5, 6, 7, 8];
  scratch[0] = toU8(seed);
  const t: i32 = sum(scratch);
  wipe(scratch);
  return t;
};

export const main = (): i32 => {
  console.log(work(toI32(process.argv.length)));
  return 0;
};
