// A frame header is read from a window `(buf, off, len)` the program chose, so
// a window that does not lie inside its buffer panics rather than reading past
// it. It panics, on stderr, with
//
//     h3ReadFrameHeader: the window [1, 1 + 3) is outside a buffer of 3 bytes
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { Http3FrameHeader, h3ReadFrameHeader } from "nish/net/http3-frame";

export const main = (): i32 => {
  const h = new Http3FrameHeader();
  const bytes: u8[] = [7, 1, 4];
  console.log(`a window of 3 bytes: ${h3ReadFrameHeader(h, bytes, 0, 3)} ${h.type}`);
  console.log(`unreachable: ${h3ReadFrameHeader(h, bytes, 1, 3)}`);
  return 0;
};
