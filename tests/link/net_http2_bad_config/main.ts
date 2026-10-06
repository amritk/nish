// The caps of an `Http2Connection` are the program's, fixed at start-up, so a
// cap RFC 9113 does not allow is the program's mistake and panics when the
// connection is made — here a SETTINGS_MAX_FRAME_SIZE below the 16,384 every
// endpoint must accept (§6.5.2). It panics, on stderr, with
//
//     Http2Connection: maxFrameSize of 1024, outside 16384 to 16777215
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { Http2Config, Http2Connection } from "nish/net/http2";

export const main = (): i32 => {
  const config = new Http2Config();
  console.log(`the defaults make a connection: ${new Http2Connection(config).outputEnd > 0}`);
  config.maxFrameSize = 1024;
  console.log(`unreachable: ${new Http2Connection(config).outputEnd}`);
  return 0;
};
