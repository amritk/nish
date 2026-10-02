// A length past 255 panics. RFC 8446 §7.1's `uint16 length` could carry more, but
// no TLS 1.3 or QUIC key, IV or secret is longer than 48 bytes, so the module
// stops at 255 and a caller's arithmetic slip panics instead of deriving a key.
//
// It panics, on stderr, with
//
//     hkdfExpandLabelSha256: a length of 256 bytes, outside 0 to 255
//
// and exits 1; stdout stops at the line printed for the largest accepted
// value. The link harness compares stdout and the exit code only, so the
// message is named here rather than pinned.
import { hkdfExpandLabelSha256 } from "nish/crypto/hkdf";

export const main = (): i32 => {
  const secret: u8[] = new Array<u8>(32);
  const most: i32 = 255;
  const over: i32 = 256;
  console.log(`a length of 255: ${toI32(hkdfExpandLabelSha256(secret, "key", [], most).length)} bytes`);
  const refused: u8[] = hkdfExpandLabelSha256(secret, "key", [], over);
  console.log(`unreachable: answered ${toI32(refused.length)} bytes`);
  return 0;
};
