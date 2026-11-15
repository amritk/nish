// An array too short for the 32-byte digest panics in `Sha256.digestInto`
// ("Sha256: the digest window is outside its array", on stderr) rather than
// writing the part that fits. Exit 1, and stdout stops at the line printed
// before the misuse.
import { Sha256 } from "nish/crypto/sha256";

export const main = (): i32 => {
  const data: u8[] = [97, 98, 99];
  const start: i32 = 0;
  const h: Sha256 = new Sha256();
  h.update(data, start, toI32(data.length));
  const out: u8[] = new Array<u8>(31);
  console.log("writing a digest into a 31-byte array");
  h.digestInto(out, start);
  console.log("unreachable: a 31-byte digest window was accepted");
  return 0;
};
