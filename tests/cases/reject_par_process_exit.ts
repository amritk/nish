// `process.exit` ends the program with a code of its own choosing, which a
// caller's other threads can see: a panic's exit is not output, and this is.
import { parallelMapInto } from "nish/threads";

const shout = (x: i32): i32 => {
  if (x < 0) {
    process.exit(3);
  }
  return x;
};

export const main = (): i32 => {
  const out: i32[] = [0, 0];
  parallelMapInto([1, 2], out, shout);
  return out[0];
};
