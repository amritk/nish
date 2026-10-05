// HKDF-Expand-Label through the scratch panics on an empty label
// ("hkdfExpandLabelInto: a label of 0 bytes, outside 1 to 249", on stderr),
// as `hkdfExpandLabelSha256` does. Exit 1, and nothing on stdout after the
// line printed before the misuse.
import { HkdfScratch, hkdfExpandLabelInto } from "nish/crypto/hkdf";

export const main = (): i32 => {
  const kdf = new HkdfScratch();
  const secret: u8[] = new Array<u8>(32);
  const none: u8[] = [];
  const out: u8[] = new Array<u8>(16);
  console.log("expanding with an empty label");
  hkdfExpandLabelInto(kdf, toI32(32), secret, "", none, toI32(0), toI32(0), out, toI32(0), toI32(16));
  console.log("unreachable: an empty label was accepted");
  return 0;
};
