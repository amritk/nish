// WP35: a parallel body cannot reach a capability. `Date.now` is `clock`, and
// its runtime entry writes memory the runtime shares, so the WP29 rule refuses
// the body before any capability is computed; `caps_parallel` relies on it.
import { parallelMapInto } from "nish/threads";

const stamp = (x: i32): f64 => toF64(x) + Date.now() * 0.0;

export const main = (): number => {
  const src: i32[] = [1, 2, 3];
  const dst: f64[] = [0.0, 0.0, 0.0];
  parallelMapInto(src, dst, stamp);
  return 0;
};
