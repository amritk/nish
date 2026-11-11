// The deadline is an `i32` of milliseconds, as `pollWait`'s is: a fraction of
// a millisecond is not one.
export const main = (): i32 => {
  const none: u8[] = [];
  const out: u8[] = [];
  const err: u8[] = [];
  const wait: f64 = 1.5;
  return spawnPipedWithin(["true"], none, out, err, wait);
};
