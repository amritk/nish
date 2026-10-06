// A Stream Cancellation carries this endpoint's own stream ID, never a peer's
// bytes, so one outside 0 to 2^62 - 1 is the program's mistake and panics in
// the integer writer.
//
// It panics, on stderr, with
//
//     qpackPushInteger: a value of -1 with a 6-bit prefix
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { qpackPushStreamCancellation } from "nish/net/qpack";

export const main = (): i32 => {
  const out: u8[] = [];
  qpackPushStreamCancellation(out, toI64(4));
  console.log(`stream 4 cancelled in ${out.length} byte`);
  qpackPushStreamCancellation(out, toI64(-1));
  console.log(`unreachable: ${out.length} bytes`);
  return 0;
};
