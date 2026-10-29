// `mkdirSyncMode(path, mode)` makes one directory with `mode` less the umask
// and answers 0 or a negative errno: a path already there is -17 (`EEXIST`),
// its mode left as it was, and a mode outside 0..0o777 is -22, the sticky bit
// included. The mode is
// read back by the `fs_mode` block in tests/run.js.
export function main(): number {
  const dir = "build/test/io_mkdir_mode.d";
  spawnSync(["rm", "-rf", dir]);
  console.log(`first: ${mkdirSyncMode(dir, 0o700)}`);
  console.log(`second: ${mkdirSyncMode(dir, 0o700)}`);
  console.log(`a directory: ${isDirectorySync(dir)}`);
  console.log(`bad mode: ${mkdirSyncMode("build/test/io_mkdir_mode.e", -1)}`);
  console.log(`sticky bit: ${mkdirSyncMode("build/test/io_mkdir_mode.e", 0o1700)}`);
  console.log(`missing parent: ${mkdirSyncMode("build/test/io_mkdir_mode.e/f", 0o700)}`);
  return 0;
}
