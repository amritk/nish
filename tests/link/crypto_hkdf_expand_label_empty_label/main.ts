// An empty label panics: `"tls13 "` alone is 6 bytes, under `opaque
// label<7..255>`'s 7 (RFC 8446 §7.1). No TLS 1.3 or QUIC derivation uses one.
//
// It panics, on stderr, with
//
//     hkdfExpandLabelSha384: a label of 0 bytes, outside 1 to 249
//
// and exits 1; stdout stops at the line printed for the largest accepted
// value. The link harness compares stdout and the exit code only, so the
// message is named here rather than pinned.
import { hkdfExpandLabelSha384 } from "nish/crypto/hkdf";

export const main = (): i32 => {
  const secret: u8[] = new Array<u8>(48);
  const len: i32 = 12;
  console.log(`one-byte label: ${toI32(hkdfExpandLabelSha384(secret, "k", [], len).length)} bytes`);
  const refused: u8[] = hkdfExpandLabelSha384(secret, "", [], len);
  console.log(`unreachable: answered ${toI32(refused.length)} bytes`);
  return 0;
};
