// `console.log` writes to a stream the caller shares, so a body that logs is a
// shared write, named by the runtime symbol it lowers to.
import { parallelMapInto } from "nish/threads";

const shout = (x: i32): i32 => {
  console.log("x");
  return x;
};

export const main = (): i32 => {
  const out: i32[] = [0, 0];
  parallelMapInto([1, 2], out, shout);
  return out[0];
};
