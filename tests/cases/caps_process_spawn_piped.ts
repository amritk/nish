// WP35: `spawnPiped` is `process.spawn`, reached from `main` through `run`.
// The capture arrays are the caller's, so the report names only the one call.
const run = (script: string, out: u8[], err: u8[]): i32 => {
  const none: u8[] = [];
  return spawnPiped(["sh", "-c", script], none, out, err);
};

export const main = (): i32 => {
  const out: u8[] = [];
  const err: u8[] = [];
  const status = run("printf ok; exit 3", out, err);
  console.log(`${status} ${out.length} ${err.length}`);
  return 0;
};
