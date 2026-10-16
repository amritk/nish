// `console.error` writes to a stream the caller shares, as `console.log` does:
// a panic's message is not output, and this is.
import { parallelMapInto } from "nish/threads";

const shout = (x: i32): i32 => {
  console.error("x");
  return x;
};

export const main = (): i32 => {
  const out: i32[] = [0, 0];
  parallelMapInto([1, 2], out, shout);
  return out[0];
};
