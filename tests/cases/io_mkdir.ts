// `mkdirSync` (WP14 D4): one directory, never recursive, answering whether a
// directory is there afterwards rather than exiting — the same bargain
// `readFileSyncOrNull` makes, so a driver phrases its own diagnostic. The last
// two cases are the failures: no parent to create it in, and a plain file
// already sitting at the path.
export function main(): number {
  const dir = "build/test/io_mkdir_dir";
  console.log(`fresh: ${mkdirSync(dir)}`);
  console.log(`already there: ${mkdirSync(dir)}`);
  console.log(`no parent: ${mkdirSync("build/test/io_mkdir_absent/child")}`);
  const file = "build/test/io_mkdir_file";
  writeFileSync(file, "not a directory\n");
  console.log(`over a file: ${mkdirSync(file)}`);
  return 0;
}
