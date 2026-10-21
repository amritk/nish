// `nish:secret`: the wipe of a `Secret` bound with no annotation survives
// `-O2` (#613). `key`'s type is `secret`'s inferred result, `Secret<u8[]>`,
// whose struct this module defines through the call alone; nothing reads the
// key after the `wipe`, which is exactly the store an optimiser deletes. Its
// twin `secret_wipe_o2_inferred_plain` zeroes the same array, held the same
// way, with `fill(0)`, an ordinary store; here the `wipe` stays a volatile
// `llvm.memset` (`tests/run.js`, "nish:secret: an inferred `Secret`'s wipe
// survives opt -O2").
import { expose, secret, wipe } from "nish:secret";

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
  const key = secret(scratch);
  const t: i32 = expose(key, sum);
  wipe(key);
  return t;
};

export const main = (): i32 => {
  console.log(work(toI32(process.argv.length)));
  return 0;
};
