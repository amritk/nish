// `nish:secret`: a holder's `wipe()` survives `-O2`. `work` makes a holder,
// reads its key once through `expose`, and wipes it; nothing reads the bytes
// again. The wipe stays a volatile `llvm.memset` over the key's bytes after
// `opt -O2`, where its twin `secret_field_wipe_o2_plain`, which keeps the same
// bytes in a plain field and zeroes them with `fill(0)`, gets an ordinary one
// the optimiser may drop (`tests/run.js`, "nish:secret: a holder's wipe
// survives opt -O2").
import { Secret, expose, secret, wipe } from "nish:secret";

const sum = (k: u8[]): i32 => {
  let t: i32 = 0;
  for (let i: i32 = 0; i < toI32(k.length); i++) {
    t = t + toI32(k[i]);
  }
  return t;
};

class Holder {
  readonly k: Secret<u8[]>;
  constructor(seed: u8) {
    this.k = secret([seed, toU8(2), toU8(3), toU8(4), toU8(5), toU8(6), toU8(7), toU8(8)]);
  }
  tag(): i32 {
    return expose(this.k, sum);
  }
  wipe(): void {
    wipe(this.k);
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
