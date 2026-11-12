// WP51 stage 2: `parallelMapInto` takes no function reference.
import { parallelMapInto } from "nish/threads";
type F = (x: i32) => i32;
const double = (x: i32): i32 => x * 2;
export const main = (): i32 => {
  const fs: F[] = [double];
  const out: i32[] = [0, 0];
  parallelMapInto([1, 2], out, fs[0]);
  return out[1];
};
