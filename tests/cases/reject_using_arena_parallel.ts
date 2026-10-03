// A parallel body may not open a `using a = arena()` block, for the reason it
// may not call `Arena.*`: every thread has an arena of its own.
import { parallelMapInto } from "nish/threads";

const body = (x: i32): i32 => {
  using a = arena();
  return x + 1;
};

export const main = (): i32 => {
  const out: i32[] = [0, 0];
  parallelMapInto([7, 42], out, body);
  return out[1];
};
