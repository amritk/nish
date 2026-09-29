// WP34 N3: the same descriptor through `nish:process`, driven the other way
// round by the `os_` block of tests/run.js: SIGINT first, then SIGTERM.
import { readSignal, signalFd } from "nish:process";

export const main = (): number => {
  const fd = signalFd();
  console.log("ready");
  console.log(readSignal(fd));
  console.log(readSignal(fd));
  return 0;
};
