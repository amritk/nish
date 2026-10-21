// The control for `secret_wipe_o2_inferred`: the same scratch array, bound
// with no annotation, zeroed with a plain `fill(0)` where the twin calls
// `wipe`. What `opt -O2` does with that ordinary store is what makes the
// twin's volatile `llvm.memset` mean something (`tests/run.js`, "nish:secret:
// an inferred `Secret`'s wipe survives opt -O2").

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
  const key = scratch;
  const t: i32 = sum(key);
  key.fill(0);
  return t;
};

export const main = (): i32 => {
  console.log(work(toI32(process.argv.length)));
  return 0;
};
