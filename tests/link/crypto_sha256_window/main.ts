// A window that runs past the end of its buffer is refused rather than hashing
// the bytes that are there: a digest of a short read looks exactly like a
// digest of the right bytes, so `Sha256.update` absorbs none of it and answers
// `false`. The hasher is left as it was, so the digest is SHA-256("abc").
// Without the check the window would be hashed short and the digest would
// differ.
import { Sha256, sha256 } from "nish/crypto/sha256";

const same = (a: u8[], b: u8[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let i: i32 = 0; i < toI32(a.length); i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};

export const main = (): i32 => {
  const data: u8[] = [97, 98, 99];
  const off: i32 = 1;
  const len: i32 = 3;
  const start: i32 = 0;
  const h: Sha256 = new Sha256();
  console.log("hashing data[1 .. 4) of a 3-byte buffer");
  console.log(`accepted: ${h.update(data, off, len)}`);
  h.update(data, start, toI32(data.length));
  console.log(`digest is SHA-256("abc"): ${same(h.digest(), sha256(data))}`);
  return 0;
};
