// `crypto_hkdf_expand_label_long_context` under `--number-mode f64` (see `args`),
// with SHA-384: there the context's length is an `f64` compared with a literal,
// and 256 bytes still panic.
//
// It panics, on stderr, with
//
//     hkdfExpandLabelSha384: a context of more than 255 bytes
//
// and exits 1; stdout stops at the line printed for the largest accepted
// value. The link harness compares stdout and the exit code only, so the
// message is named here rather than pinned.
import { hkdfExpandLabelSha384 } from "nish/crypto/hkdf";

export const main = (): i32 => {
  const secret: u8[] = new Array<u8>(48);
  const len: i32 = 16;
  const most: u8[] = new Array<u8>(255);
  const over: u8[] = new Array<u8>(256);
  console.log(`255-byte context: ${toI32(hkdfExpandLabelSha384(secret, "key", most, len).length)} bytes`);
  const refused: u8[] = hkdfExpandLabelSha384(secret, "key", over, len);
  console.log(`unreachable: answered ${toI32(refused.length)} bytes`);
  return 0;
};
