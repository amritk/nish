// A writer refuses to write a frame its reader must refuse, and the frames
// only a program can get wrong — DATA on stream 0, which no peer may accept
// (RFC 9113 §6.1) — are the program's mistake, so it panics. It panics, on
// stderr, with
//
//     http2WriteData: DATA on stream 0
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { http2WriteData } from "nish/net/http2-frame";

export const main = (): i32 => {
  const out: u8[] = new Array<u8>(32);
  const body: u8[] = [104, 105];
  console.log(`DATA on stream 1 ends at ${http2WriteData(out, 0, 1, body, 0, 2, 1, -1)}`);
  console.log(`unreachable: ${http2WriteData(out, 0, 0, body, 0, 2, 1, -1)}`);
  return 0;
};
