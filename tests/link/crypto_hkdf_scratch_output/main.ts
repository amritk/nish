// An output window outside its array panics in `hkdfExtractInto`
// ("hkdfExtractInto: the output window is outside its array", on stderr)
// before a byte is written: the PRK is HashLen bytes, and 32 do not fit at
// out[1] of 32. Exit 1, and nothing on stdout after the line printed before
// the misuse.
import { HkdfScratch, hkdfExtractInto } from "nish/crypto/hkdf";

export const main = (): i32 => {
  const kdf = new HkdfScratch();
  const salt: u8[] = [];
  const ikm: u8[] = [1, 2, 3];
  const out: u8[] = new Array<u8>(32);
  console.log("extracting 32 bytes at out[1] of 32");
  hkdfExtractInto(kdf, toI32(32), salt, ikm, out, toI32(1));
  console.log("unreachable: an out-of-range output window was accepted");
  return 0;
};
