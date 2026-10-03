// The control for `secret_wipe_o2`: the same scratch array zeroed with a plain
// `fill(0)`, which `opt -O2` deletes along with every other store to it, because
// nothing reads the bytes again. That it is deleted is what makes the twin's
// surviving volatile stores mean something (`tests/run.js`, "nish:secret: the
// wipe survives opt -O2").

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
  scratch.fill(0);
  return t;
};

export const main = (): i32 => {
  console.log(work(toI32(process.argv.length)));
  return 0;
};
