// HKDF-Expand-Label through the scratch panics on a length outside 0 to 255
// ("hkdfExpandLabelInto: a length of 256 bytes, outside 0 to 255", on
// stderr), as `hkdfExpandLabelSha256` does: `HkdfLabel.length` is a uint16
// the protocol keeps to a key or a hash. Exit 1, and nothing on stdout after
// the line printed before the misuse.
import { HkdfScratch, hkdfExpandLabelInto } from "nish/crypto/hkdf";

export const main = (): i32 => {
  const kdf = new HkdfScratch();
  const secret: u8[] = new Array<u8>(32);
  const none: u8[] = [];
  const out: u8[] = new Array<u8>(300);
  console.log("expanding 256 bytes");
  hkdfExpandLabelInto(kdf, toI32(32), secret, "key", none, toI32(0), toI32(0), out, toI32(0), toI32(256));
  console.log("unreachable: a 256-byte length was accepted");
  return 0;
};
