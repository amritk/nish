// A parallel body may not allocate: a worker's arena is freed when its thread
// exits. `digits` writes nothing its caller can see, and it builds a string.
import { parallelMapInto } from "nish/threads";

const digits = (x: i32): i32 => `${x}`.length;

export const main = (): i32 => {
  const out: i32[] = [0, 0];
  parallelMapInto([7, 42], out, digits);
  return out[1];
};
