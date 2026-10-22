// A `PreforkConfig` whose backoff is zero would restart a worker that dies
// young at once, every time: doubling zero never reaches the cap. `preforkWith`
// panics before it reads the arguments or starts anything, with
//
//     nish/net/prefork: backoffMs not above 0 or above backoffCapMs
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { PreforkConfig, preforkWith } from "nish/net/prefork";

export const main = (): i32 => {
  const config = new PreforkConfig();
  config.backoffMs = 0;
  console.log("a prefork backoff of zero");
  console.log(`unreachable: ${preforkWith(process.argv, config)}`);
  return 0;
};
