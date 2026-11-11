// Five arguments: `spawnPiped`'s four and the deadline. There is no default
// deadline, so a caller with none passes -1.
export const main = (): i32 => {
  const none: u8[] = [];
  const out: u8[] = [];
  return spawnPipedWithin(["true"], none, out, out);
};
