// WP34 N12: `waitPid(-1, 1)` is a WNOHANG wait for any child. With a child
// still running it answers `[0, 0]`; once every child is reaped it answers
// ECHILD in the first element, `[-10, 0]`. A flag other than WNOHANG is -22.
export const main = (): number => {
  const pid = spawn(["sleep", "30"]);
  const none = waitPid(-1, 1);
  console.log(none[0]);
  console.log(none[1]);
  console.log(waitPid(pid, 2)[0]);
  console.log(kill(pid, 9));
  const done = waitPid(-1, 0);
  console.log(done[0] === pid);
  console.log(done[1]);
  const empty = waitPid(-1, 1);
  console.log(empty[0]);
  console.log(empty[1]);
  return 0;
};
