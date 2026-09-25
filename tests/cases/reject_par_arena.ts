// A parallel body may not read or move the arena: every thread has an arena of
// its own, so `Arena.used()` would answer according to which thread ran the
// element. `used` writes nothing its caller can see and allocates nothing.
import { parallelMapInto } from "nish/threads";

const used = (x: i32): i32 => toI32(Arena.used()) + x;

export const main = (): i32 => {
  const out: i32[] = [0, 0];
  parallelMapInto([7, 42], out, used);
  return out[1];
};
