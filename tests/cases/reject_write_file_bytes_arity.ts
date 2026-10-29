// `writeFileBytesSync` takes a path and the whole array: no range and no mode (420 is 0644).
export function main(): number {
  const bytes: u8[] = [1, 2];
  return writeFileBytesSync("build/test/a", bytes, 420);
}
