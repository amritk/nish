// A context past 255 bytes panics: it would not fit `opaque context<0..255>`
// (RFC 8446 §7.1), and its length byte would wrap.
//
// It panics, on stderr, with
//
//     hkdfExpandLabelSha256: a context of more than 255 bytes
//
// and exits 1; stdout stops at the line printed for the largest accepted
// value. The link harness compares stdout and the exit code only, so the
// message is named here rather than pinned.
import { hkdfExpandLabelSha256 } from "nish/crypto/hkdf";

export const main = (): i32 => {
  const secret: u8[] = new Array<u8>(32);
  const len: i32 = 16;
  const most: u8[] = new Array<u8>(255);
  const over: u8[] = new Array<u8>(256);
  console.log(`255-byte context: ${toI32(hkdfExpandLabelSha256(secret, "key", most, len).length)} bytes`);
  const refused: u8[] = hkdfExpandLabelSha256(secret, "key", over, len);
  console.log(`unreachable: answered ${toI32(refused.length)} bytes`);
  return 0;
};
