// `pin` with more workers than CPUs is refused: a worker past the last CPU
// would be pinned nowhere and, steered, handed no connection. On Linux
// `preforkWith` panics before it starts anything, with
//
//     nish/net/prefork: pin with <n + 1> workers on <n> CPUs
//
// and exits 1. Elsewhere `pin` is a no-op that says so, so the program exits 1
// itself to keep one expected code. The link harness compares stdout and the
// exit code only, so the message is named here rather than pinned.
import { availableParallelism, platform } from "nish:process";
import { PreforkConfig, preforkWith } from "nish/net/prefork";

export const main = (): i32 => {
  const config = new PreforkConfig();
  config.pin = true;
  config.workers = availableParallelism() + 1;
  console.log("one pinned worker more than the CPUs");
  if (platform !== "linux") {
    return 1;
  }
  console.log(`unreachable: ${preforkWith(process.argv, config)}`);
  return 0;
};
