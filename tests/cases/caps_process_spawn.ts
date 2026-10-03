// WP35: `spawnSync` is `process.spawn`, reached from `main` through `run`.
// The child is `sh -c`, the one program every POSIX host has.
const run = (script: string): number => spawnSync(["sh", "-c", script]);

export const main = (): number => {
  console.log(run("exit 3"));
  return 0;
};
