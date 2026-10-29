// The output arrays are appended to, so a `readonly u8[]` is refused for
// either one, as it is for `push`.
export const main = (): i32 => {
  const none: u8[] = [];
  const frozen: readonly u8[] = [];
  const err: u8[] = [];
  spawnPiped(["true"], none, frozen, err);
  return spawnPiped(["true"], none, err, frozen);
};
