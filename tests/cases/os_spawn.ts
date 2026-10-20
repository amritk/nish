// WP34 N12: `spawn(argv)` starts a child and answers its pid at once, without
// waiting; `waitPid(pid, 0)` then reaps it and answers `[pid, status]`, with
// `spawnSync`'s status convention. The parent runs while the child sleeps: a
// WNOHANG wait straight after the spawn finds it still running, `[0, 0]`.
export const main = (): number => {
  const pid = spawn(["sh", "-c", "sleep 0.5; exit 3"]);
  console.log(pid > 0);
  console.log(waitPid(pid, 1)[0]);
  const done = waitPid(pid, 0);
  console.log(done[0] === pid);
  console.log(done[1]);
  // A program that cannot be found starts no child: the answer is -ENOENT,
  // and there is nothing to reap.
  console.log(spawn(["/nonexistent/nish-no-such-program"]));
  console.log(spawn([]));
  return 0;
};
