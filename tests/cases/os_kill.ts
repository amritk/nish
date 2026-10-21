// WP34 N12: `kill(pid, sig)` answers 0 or a negative errno. SIGTERM to a
// sleeping child makes `waitPid` answer 128 + 15; signal 0 probes a process
// that exists; a signal outside 0, 2, 9 and 15 is -22 (EINVAL), and a pid no
// process has is -3 (ESRCH).
export const main = (): number => {
  const pid = spawn(["sleep", "30"]);
  console.log(kill(pid, 0));
  console.log(kill(pid, 7));
  console.log(kill(pid, 15));
  console.log(waitPid(pid, 0)[1]);
  console.log(kill(pid, 0));
  console.log(kill(0, 15));
  return 0;
};
