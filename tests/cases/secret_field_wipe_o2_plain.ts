// The control for `secret_field_wipe_o2`: the same holder with its key in a
// plain `u8[]` field, zeroed by `fill(0)`. After `opt -O2` that zeroing is an
// ordinary, non-volatile `llvm.memset`, a store the optimiser is free to delete
// once it proves the bytes dead, which is the difference the twin's volatile
// wipe makes (`tests/run.js`, "nish:secret: a holder's wipe survives opt -O2").

const sum = (k: u8[]): i32 => {
  let t: i32 = 0;
  for (let i: i32 = 0; i < toI32(k.length); i++) {
    t = t + toI32(k[i]);
  }
  return t;
};

class Holder {
  readonly k: u8[];
  constructor(seed: u8) {
    this.k = [seed, toU8(2), toU8(3), toU8(4), toU8(5), toU8(6), toU8(7), toU8(8)];
  }
  tag(): i32 {
    return sum(this.k);
  }
  wipe(): void {
    this.k.fill(0);
  }
}

const work = (seed: i32): i32 => {
  const h = new Holder(toU8(seed));
  const t: i32 = h.tag();
  h.wipe();
  return t;
};

export const main = (): i32 => {
  console.log(work(toI32(process.argv.length)));
  return 0;
};
