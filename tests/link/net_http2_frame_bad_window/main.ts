// A frame is read from a window `(buf, off, len)` the program chose, so a
// window that does not lie inside its buffer panics rather than reading past
// it. It panics, on stderr, with
//
//     http2ReadHeader: the window [0, 0 + 10) is outside a buffer of 9 bytes
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { Http2Frame, http2ReadHeader } from "nish/net/http2-frame";

export const main = (): i32 => {
  const frame = new Http2Frame();
  const header: u8[] = [0, 0, 0, 4, 1, 0, 0, 0, 0];
  console.log(`a window of 9 bytes: ${http2ReadHeader(frame, header, 0, 9)} ${frame.type}`);
  console.log(`unreachable: ${http2ReadHeader(frame, header, 0, 10)}`);
  return 0;
};
