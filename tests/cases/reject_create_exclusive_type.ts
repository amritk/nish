// The data is a string; a `u8[]` goes through `writeFileBytesSync` instead.
export const main = (): number => {
  const bytes: u8[] = [120];
  return createFileExclusiveSync("build/test/a.lock", bytes, 0o600);
};
