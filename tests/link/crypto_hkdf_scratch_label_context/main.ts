// HKDF-Expand-Label through the scratch panics on a context window outside
// its array ("hkdfExpandLabelInto: the context window is outside its array
// or longer than 255 bytes", on stderr). Exit 1, and nothing on stdout after
// the line printed before the misuse.
import { HkdfScratch, hkdfExpandLabelInto } from "nish/crypto/hkdf";

export const main = (): i32 => {
  const kdf = new HkdfScratch();
  const secret: u8[] = new Array<u8>(32);
  const context: u8[] = new Array<u8>(32);
  const out: u8[] = new Array<u8>(16);
  console.log("expanding with context[1 .. 33) of 32 bytes");
  hkdfExpandLabelInto(kdf, toI32(32), secret, "key", context, toI32(1), toI32(32), out, toI32(0), toI32(16));
  console.log("unreachable: an out-of-range context window was accepted");
  return 0;
};
