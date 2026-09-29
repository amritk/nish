// A window that runs past the end of its buffer panics rather than hashing
// the bytes that are there: a digest of a short read looks exactly like a
// digest of the right bytes, so `Sha256.update` refuses it outright. Exit 1,
// and nothing on stdout after the line printed before the misuse.
import { Sha256 } from "nish/crypto/sha256";

export const main = (): i32 => {
  const data: u8[] = [97, 98, 99];
  const off: i32 = 1;
  const len: i32 = 3;
  const h: Sha256 = new Sha256();
  console.log("hashing data[1 .. 4) of a 3-byte buffer");
  h.update(data, off, len);
  console.log("unreachable: an out-of-range window was accepted");
  return 0;
};
