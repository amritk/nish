/**
 * The checks the strings and arrays share: an index as the compiler converts
 * it, and the two bounds panics with their native words. Internal to the core:
 * `runtime/core.mjs` does not re-export them.
 */
import { panic } from "./host.mjs";

/** Index conversion as in the compiler: `sext` from i32, `fptosi` (truncation) from f64. */
export function toIndex(i) {
  return typeof i === "bigint" ? Number(i) : Math.trunc(i);
}

export function panicIndex(i, len) {
  panic(`index out of range: ${i} >= ${len}`);
}

/** `nish_panic_slice`: the failed range check of `s.slice(start, end)`; the offsets print signed. */
export function panicSlice(start, end, len) {
  panic(`slice out of range: [${start}, ${end}) of length ${len}`);
}
