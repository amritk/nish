// `writeFileSyncMode(path, data, mode)` writes the file at exactly `mode`,
// set with fchmod before a byte is in it, and answers the byte count or a
// negative errno, never an exit. A file already there is truncated and
// rewritten, its mode replaced. A mode outside 0..0o7777 is -22 (`EINVAL`)
// and the file is not touched. The modes themselves are read back by the
// `fs_mode` block in tests/run.js, with Node's `fs.statSync`.
export function main(): number {
  const path = "build/test/io_write_file_mode.txt";
  writeFileSync(path, "an older and longer text");
  console.log(`write: ${writeFileSyncMode(path, "secret", 0o600)}`);
  console.log(`content: ${readFileSync(path)}`);
  console.log(`negative mode: ${writeFileSyncMode(path, "x", -1)}`);
  console.log(`mode past 0o7777: ${writeFileSyncMode(path, "x", 0o10000)}`);
  console.log(`content kept: ${readFileSync(path)}`);
  console.log(`missing directory: ${writeFileSyncMode("build/test/io_write_file_mode.d/x", "x", 0o600)}`);
  return 0;
}
