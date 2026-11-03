// A `PreforkConfig` whose listen port is no TCP port, as a hostile config
// file could give, is refused before any socket or worker exists:
// `preforkWith` panics with
//
//     nish/net/prefork: listenPort not -1 or 0..65535
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { PreforkConfig, preforkWith } from "nish/net/prefork";

export const main = (): i32 => {
  const config = new PreforkConfig();
  config.listenPort = 70000;
  console.log("a prefork listen port past 65535");
  console.log(`unreachable: ${preforkWith(process.argv, config)}`);
  return 0;
};
