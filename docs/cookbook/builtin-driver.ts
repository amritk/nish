export const main = (): number => {
  const cases = readdirSync("tests/cases");
  if (cases === null) {
    panic("cannot list tests/cases");
  }
  const started = monotonicNanos();
  const status = spawnSyncTo(["sh", "-c", "echo hello"], "build/out.txt", "");
  console.log(`${cases.length} cases, status ${status}, ${monotonicNanos() - started} ns`);
  return 0;
};
