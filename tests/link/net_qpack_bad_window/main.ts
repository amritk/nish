// A field section is a window `(buf, off, len)` the program chose, so a window
// that does not lie inside its buffer panics rather than reading past it.
//
// It panics, on stderr, with
//
//     QpackDecoder.decode: the window [0, 0 + 3) is outside a buffer of 2 bytes
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { QpackDecoder } from "nish/net/qpack";

export const main = (): i32 => {
  const limit: i32 = 4096;
  const dec = new QpackDecoder(limit);
  const section: u8[] = [0, 0];
  const start: i32 = 0;
  const whole: i32 = 2;
  const past: i32 = 3;
  console.log(`a window of 2 bytes: ${dec.decode(section, start, whole)}`);
  console.log(`unreachable: ${dec.decode(section, start, past)}`);
  return 0;
};
