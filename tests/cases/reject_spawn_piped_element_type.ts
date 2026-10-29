// The argument vector goes to `posix_spawnp` as it stands, so its element type
// is checked: an `i32[]` is an array but not a command line.
export const main = (): i32 => {
  const argv: i32[] = [1, 2];
  const none: u8[] = [];
  const out: u8[] = [];
  const err: u8[] = [];
  return spawnPiped(argv, none, out, err);
};
