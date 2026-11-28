// A window whose `off + len` passes 2^31 - 1 is refused. Summed in an `i32`,
// 1 + (2^31 - 1) wraps to a negative end that a check written as
// `off + len > size` would let through; `Sha256.update` compares `len` with
// `size - off` instead, which cannot wrap, absorbs nothing and answers
// `false`, and the digest is still SHA-256("abc").
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
  const len: i32 = 2147483647;
  const start: i32 = 0;
  const h: Sha256 = new Sha256();
  console.log("hashing data[1 .. 2^31) of a 3-byte buffer");
  console.log(`accepted: ${h.update(data, off, len)}`);
  h.update(data, start, toI32(data.length));
  console.log(`digest is SHA-256("abc"): ${same(h.digest(), sha256(data))}`);
  return 0;
};
