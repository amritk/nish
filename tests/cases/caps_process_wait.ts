// WP34 N12: `spawn`, `kill` and `waitPid` are `process.spawn`, as `spawnSync`
// is: starting a child, signalling a process and reaping a child all act on
// processes. `main` is witnessed by the `spawn` it calls itself, and `stop`
// by the first of the two it calls, `kill`.
export const stop = (pid: i32): i32 => {
  kill(pid, 15);
  return waitPid(pid, 0)[1];
};

export const main = (): number => {
  console.log(stop(spawn(["sleep", "30"])));
  return 0;
};
