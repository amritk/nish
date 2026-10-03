// `hpackDecodeInteger` refuses a prefix outside 1 to 8 bits as
// `hpackEncodeInteger` does, by panicking: the width is the program's, not
// the peer's.
//
// It panics, on stderr, with
//
//     hpackDecodeInteger: a 0-bit prefix, outside 1 to 8
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { HpackCursor, hpackDecodeInteger } from "nish/net/hpack";

export const main = (): i32 => {
  const block: u8[] = [0, 1];
  const c = new HpackCursor(block, 0, 2);
  console.log(`a 1-bit prefix: ${hpackDecodeInteger(c, 1)}`);
  console.log(`unreachable: ${hpackDecodeInteger(c, 0)}`);
  return 0;
};
