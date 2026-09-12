// The two paths are strings like every other path in the language: a number is
// not a file name, and nothing converts it into one.
function f(): number {
  return spawnSyncTo(["sh", "-c", "true"], 1, "err.txt");
}
