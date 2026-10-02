// A label past 249 bytes panics: with the 6-byte `"tls13 "` prefix it would not
// fit `opaque label<7..255>` (RFC 8446 §7.1), and its length byte would wrap.
//
// It panics, on stderr, with
//
//     hkdfExpandLabelSha256: a label of 250 bytes, outside 1 to 249
//
// and exits 1; stdout stops at the line printed for the largest accepted
// value. The link harness compares stdout and the exit code only, so the
// message is named here rather than pinned.
import { hkdfExpandLabelSha256 } from "nish/crypto/hkdf";
import { letters } from "../crypto_hkdf_expand_label/checks";

export const main = (): i32 => {
  const secret: u8[] = new Array<u8>(32);
  const len: i32 = 16;
  const longest: string = letters(249);
  const over: string = `${longest}a`;
  console.log(`249-byte label: ${toI32(hkdfExpandLabelSha256(secret, longest, [], len).length)} bytes`);
  const refused: u8[] = hkdfExpandLabelSha256(secret, over, [], len);
  console.log(`unreachable: answered ${toI32(refused.length)} bytes`);
  return 0;
};
