// A negative length panics; `HkdfLabel.length` is unsigned.
//
// It panics, on stderr, with
//
//     hkdfExpandLabelSha384: a length of -1 bytes, outside 0 to 255
//
// and exits 1; stdout stops at the line printed for the largest accepted
// value. The link harness compares stdout and the exit code only, so the
// message is named here rather than pinned.
import { hkdfExpandLabelSha384 } from "nish/crypto/hkdf";

export const main = (): i32 => {
  const secret: u8[] = new Array<u8>(48);
  const zero: i32 = 0;
  const below: i32 = toI32(-1);
  console.log(`a length of 0: ${toI32(hkdfExpandLabelSha384(secret, "key", [], zero).length)} bytes`);
  const refused: u8[] = hkdfExpandLabelSha384(secret, "key", [], below);
  console.log(`unreachable: answered ${toI32(refused.length)} bytes`);
  return 0;
};
