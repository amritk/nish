// `createFileExclusiveSync(path, data, mode)` creates the file only if
// nothing is at the path (`O_EXCL`): the first call answers the byte count,
// every later one -17 (`EEXIST`) and leaves the first one's bytes in place.
// That is a lock: of several processes racing for one path exactly one wins,
// which the `fs_mode` block in tests/run.js races for.
export function main(): number {
  const path = "build/test/io_create_exclusive.lock";
  unlinkSync(path);
  console.log(`first: ${createFileExclusiveSync(path, "pid 1", 0o600)}`);
  console.log(`second: ${createFileExclusiveSync(path, "pid 2", 0o600)}`);
  console.log(`content: ${readFileSync(path)}`);
  console.log(`bad mode: ${createFileExclusiveSync("build/test/io_create_exclusive.other", "x", 0o10000)}`);
  console.log(`released: ${unlinkSync(path)}`);
  console.log(`again: ${createFileExclusiveSync(path, "pid 3", 0o600)}`);
  return 0;
}
