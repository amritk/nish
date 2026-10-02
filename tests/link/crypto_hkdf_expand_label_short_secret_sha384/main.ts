// A SHA-256 secret handed to the SHA-384 derivation panics: 32 bytes is shorter
// than SHA-384's HashLen (RFC 5869 §2.3), where `hkdfExpandSha384` answers `null`.
//
// It panics, on stderr, with
//
//     hkdfExpandLabelSha384: a secret shorter than 48 bytes
//
// and exits 1; stdout stops at the line printed for the largest accepted
// value. The link harness compares stdout and the exit code only, so the
// message is named here rather than pinned.
import { hkdfExpandLabelSha384 } from "nish/crypto/hkdf";

export const main = (): i32 => {
  const secret: u8[] = new Array<u8>(48);
  const short: u8[] = new Array<u8>(32);
  const len: i32 = 16;
  console.log(`48-byte secret: ${toI32(hkdfExpandLabelSha384(secret, "key", [], len).length)} bytes`);
  const refused: u8[] = hkdfExpandLabelSha384(short, "key", [], len);
  console.log(`unreachable: answered ${toI32(refused.length)} bytes`);
  return 0;
};
