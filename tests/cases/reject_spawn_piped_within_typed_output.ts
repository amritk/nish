// The output arrays are appended to, so a typed-array spelling is refused for
// either one, as it is for `spawnPiped`: its length is fixed.
export const main = (): i32 => {
  const none: u8[] = [];
  const err: u8[] = [];
  const fixed: Float64Array = new Float64Array(2);
  return spawnPipedWithin(["true"], none, err, fixed, 100);
};
