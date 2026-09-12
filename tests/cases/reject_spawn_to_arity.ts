// Three arguments: the vector and one path per redirected stream. There are no
// optional parameters, so the caller that wants stderr inherited passes "".
function f(): number {
  return spawnSyncTo(["sh", "-c", "true"], "out.txt");
}
