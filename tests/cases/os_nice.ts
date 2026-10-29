// `setNice(n)` answers 0 or a negative errno, and a child started afterwards
// inherits the value: `ps` run from it reads 1. Raising the priority again to
// -20 needs the privilege to, so it is 0 as root and a negative errno (-13,
// EACCES, on Linux) otherwise, which this prints as one line either way.
// `setIdlePriority` moves the case's own process, a child of the runner, to
// SCHED_IDLE on Linux, where `ps` reads its class as IDL, and is -95
// elsewhere; the runner itself is never demoted.
export const main = (): number => {
  console.log(setNice(1));
  console.log(spawnSync(["sh", "-c", 'test "$(ps -o nice= -p $$)" -eq 1']));
  const raised = setNice(-20);
  console.log(geteuid() === 0 ? raised === 0 : raised < 0);
  const idle = setIdlePriority();
  if (process.platform === "linux") {
    console.log(idle);
    console.log(spawnSync(["sh", "-c", 'test "$(ps -o cls= -p $$)" = IDL']));
  } else {
    console.log(idle + 95);
    console.log(0);
  }
  return 0;
};
