// A §5.1 prefix is 1 to 8 bits, and the program picks it, so `hpackEncodeInteger`
// panics on any other width, and on a negative value.
//
// It panics, on stderr, with
//
//     hpackEncodeInteger: a value of 5 with a 9-bit prefix, outside 1 to 8
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { hpackEncodeInteger } from "nish/net/hpack";

export const main = (): i32 => {
  const out: u8[] = [];
  hpackEncodeInteger(out, 0, 8, 5);
  console.log(`an 8-bit prefix: ${toI32(out.length)} byte`);
  hpackEncodeInteger(out, 0, 9, 5);
  console.log(`unreachable: ${toI32(out.length)} bytes`);
  return 0;
};
