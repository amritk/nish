// `unlinkSync(path)` is unlink(2): the name is removed and 0 answered. A
// missing path is -2 (`ENOENT`), and a directory is refused, -21 (`EISDIR`)
// on Linux and -1 (`EPERM`) on the BSDs and macOS, with no fall back to
// rmdir(2): removing a directory is a different request.
export function main(): number {
  const file = "build/test/io_unlink.txt";
  writeFileSync(file, "doomed\n");
  console.log(`unlink: ${unlinkSync(file)}`);
  console.log(`gone: ${readFileSyncOrNull(file) === null}`);
  console.log(`missing: ${unlinkSync(file)}`);
  const dir = "build/test/io_unlink_dir";
  mkdirSync(dir);
  const refused = unlinkSync(dir);
  console.log(`directory refused: ${refused === -21 || refused === -1}`);
  console.log(`directory kept: ${isDirectorySync(dir)}`);
  return 0;
}
