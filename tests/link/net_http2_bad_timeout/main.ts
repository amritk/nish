// A connection's timeouts are the program's, fixed at start-up, so one of no
// time at all would end every connection before its client could answer: the
// program's mistake, which panics when the connection is made — here a
// settingsTimeout of 0 ms. It panics, on stderr, with
//
//     Http2Connection: settingsTimeout of 0, outside 1 to 2147483647
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { Http2Config, Http2Connection } from "nish/net/http2";

export const main = (): i32 => {
  const config = new Http2Config();
  console.log(`the default timeouts make a connection: ${new Http2Connection(config).wantsWrite()}`);
  config.settingsTimeout = 0;
  console.log(`unreachable: ${new Http2Connection(config).outputEnd}`);
  return 0;
};
