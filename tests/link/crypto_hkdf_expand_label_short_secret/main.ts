// A secret shorter than HashLen panics, where `hkdfExpandSha256` answers `null`
// for it (RFC 5869 §2.3; docs/security/crypto-k1.md, finding K1-5).
//
// It panics, on stderr, with
//
//     hkdfExpandLabelSha256: a secret shorter than 32 bytes
//
// and exits 1; stdout stops at the line printed for the largest accepted
// value. The link harness compares stdout and the exit code only, so the
// message is named here rather than pinned.
import { hkdfExpandLabelSha256 } from "nish/crypto/hkdf";

export const main = (): i32 => {
  const secret: u8[] = new Array<u8>(32);
  const short: u8[] = new Array<u8>(31);
  const len: i32 = 16;
  console.log(`32-byte secret: ${toI32(hkdfExpandLabelSha256(secret, "key", [], len).length)} bytes`);
  const refused: u8[] = hkdfExpandLabelSha256(short, "key", [], len);
  console.log(`unreachable: answered ${toI32(refused.length)} bytes`);
  return 0;
};
