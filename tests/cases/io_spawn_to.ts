// `spawnSyncTo`: `spawnSync` with each stream sent to a file, which is what
// comparing a child's output against a golden needs — `spawnSync` answers a
// status and the output is gone.
export const main = (): number => {
  mkdirSync("build");
  const dir = "build/io_spawn_to";
  mkdirSync(dir);
  const out = `${dir}/out.txt`;
  const err = `${dir}/err.txt`;

  const status = spawnSyncTo(["sh", "-c", "echo to-stdout; echo to-stderr >&2; exit 3"], out, err);
  const captured = readFileSyncOrNull(out);
  const diagnostic = readFileSyncOrNull(err);
  if (captured === null || diagnostic === null) {
    console.log("nothing captured");
    return 1;
  }
  console.log(`${status}: ${captured.substring(0, captured.length - 1)} / ${diagnostic.substring(0, diagnostic.length - 1)}`);

  // Created or truncated, never appended: the second run must not find the first
  // run's bytes in front of its own.
  spawnSyncTo(["sh", "-c", "echo second"], out, err);
  const again = readFileSyncOrNull(out);
  if (again === null) {
    console.log("nothing captured twice");
    return 1;
  }
  console.log(`again: ${again.substring(0, again.length - 1)}`);
  return 0;
};
