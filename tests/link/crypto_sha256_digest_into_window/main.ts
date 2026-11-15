// A digest window that runs past the end of its array panics in
// `Sha256.digestInto` ("Sha256: the digest window is outside its array", on
// stderr) before anything is written. Exit 1, and stdout stops at the line
// printed before the misuse.
import { Sha256 } from "nish/crypto/sha256";

export const main = (): i32 => {
  const data: u8[] = [97, 98, 99];
  const start: i32 = 0;
  const late: i32 = 1;
  const h: Sha256 = new Sha256();
  h.update(data, start, toI32(data.length));
  const out: u8[] = new Array<u8>(32);
  console.log("writing a digest at out[1 .. 33) of a 32-byte array");
  h.digestInto(out, late);
  console.log("unreachable: a digest window past the end was accepted");
  return 0;
};
