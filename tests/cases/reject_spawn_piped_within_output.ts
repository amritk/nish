// The output arrays are appended to, so a `readonly u8[]` is refused for
// either one, as it is for `spawnPiped`.
export const main = (): i32 => {
  const none: u8[] = [];
  const frozen: readonly u8[] = [];
  const err: u8[] = [];
  spawnPipedWithin(["true"], none, frozen, err, 100);
  return spawnPipedWithin(["true"], none, err, frozen, 100);
};
