// WP34 N3: `signalFd()` and `readSignal(fd)`. The `os_` block of tests/run.js
// runs this, waits for `ready`, sends SIGTERM and then SIGINT, and requires
// 15 and then 2 and exit 0, killing it if either signal is lost. No `.out`:
// on its own it would wait for a signal forever.
export const main = (): number => {
  console.log(readSignal(0));
  const fd = signalFd();
  console.log(signalFd() === fd);
  console.log(readSignal(fd + 1));
  // A child spawned after `signalFd()` can still be stopped by either signal,
  // because `exec` resets a caught one: 128 + 15 when it signals itself.
  console.log(spawnSync(["sh", "-c", "kill -TERM $$"]));
  console.log("ready");
  console.log(readSignal(fd));
  console.log(readSignal(fd));
  return 0;
};
