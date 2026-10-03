// A block is a window `(buf, off, len)` the program chose, so a window that
// does not lie inside its buffer panics rather than reading past it.
//
// It panics, on stderr, with
//
//     HpackCursor: the window [0, 0 + 3) is outside a buffer of 2 bytes
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { HpackDecoder } from "nish/net/hpack";

export const main = (): i32 => {
  const dec = new HpackDecoder(4096, 65536);
  const block: u8[] = [130, 132];
  console.log(`a window of 2 bytes: ${dec.decode(block, 0, 2)}`);
  console.log(`unreachable: ${dec.decode(block, 0, 3)}`);
  return 0;
};
