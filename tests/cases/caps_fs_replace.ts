// WP35: the atomic-replace idiom is `fs.write` throughout: `unlinkSync` clears
// a stale temporary file, `writeFileBytesSync` writes it and `renameSync` puts
// it in place, and the report names the first of them as `replace`'s witness.
// `writeBytes` is stdout, which needs no capability, as `write` needs none; its
// range check is the one panic site.
const replace = (path: string, bytes: readonly u8[]): i32 => {
  const temp = `${path}.tmp`;
  unlinkSync(temp);
  if (writeFileBytesSync(temp, bytes) < 0) {
    return -1;
  }
  return renameSync(temp, path);
};

export const main = (): number => {
  const bytes: u8[] = [111, 107, 10];
  const done = replace("build/test/caps_fs_replace.txt", bytes);
  writeBytes(bytes, 0, 3);
  return done;
};
