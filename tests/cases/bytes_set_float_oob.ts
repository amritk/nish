// WP34 N2: an offset `ToIntegerOrInfinity` puts out of range still fails the
// range check: +Infinity and 1e300 saturate to the largest `i64`, -Infinity to
// the smallest, and each panics as an out-of-range integer does, where a bare
// `fptosi` made a poison offset that skipped the check. The printed range is
// the saturated one. `bytes_set_float_oob.c` runs each in a child and prints
// its message and its exit status.
const into = (at: f64): i32 => {
  const dst: u8[] = [0, 0, 0, 0];
  const src: u8[] = [7];
  dst.set(src, at);
  return toI32(dst[0]);
};

export const huge = (): i32 => into(1e300);

export const infinite = (): i32 => into(1.0 / 0.0);

export const negativeInfinite = (): i32 => into(-1.0 / 0.0);

export const test = (): i32 => into(0.0 / 0.0);
