// WP35: `spawnWithFds` starts a process as `spawnSync` does, so it is
// `process.spawn`, reached from `main` through `run`. It hands the child no
// descriptor here; the label is the point, not what the child inherits.
const run = (script: string): number => {
  const pid = spawnWithFds(["sh", "-c", script], []);
  return pid < 0 ? pid : waitPid(pid, 0)[1];
};

export const main = (): number => {
  console.log(run("exit 3"));
  return 0;
};
