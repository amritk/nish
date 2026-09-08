// `isDirectorySync` (WP14 §7a): the one `stat` a driver needs to tell `-o out`
// meaning "write every module into this directory" from `-o out` meaning
// "write this file". It answers rather than exits, so everything that is not a
// directory — a missing path, a device node, a file — is the same `false` and
// the caller phrases its own diagnostic.
//
// The paths are ones every POSIX host has, so what this prints does not depend
// on the working directory the harness happens to run it from.
export function main(): number {
  console.log(`cwd: ${isDirectorySync(".")}`);
  console.log(`root: ${isDirectorySync("/")}`);
  console.log(`device: ${isDirectorySync("/dev/null")}`);
  console.log(`missing: ${isDirectorySync("/no/such/directory")}`);
  return 0;
}
