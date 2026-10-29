// The child reads bytes, so stdin is a `u8[]`: a `string` is refused rather
// than encoded, and an `i32[]` rather than truncated.
export const main = (): i32 => {
  const out: u8[] = [];
  const err: u8[] = [];
  const words: i32[] = [104, 105];
  spawnPiped(["cat"], "hi", out, err);
  return spawnPiped(["cat"], words, out, err);
};
