// A window at an offset of 2^31 - 1 is refused, whatever its length: the end
// `off + len` would wrap in an `i32`, and `Sha512.update` compares `off` with
// `size - len` instead, which cannot. It absorbs nothing and answers `false`,
// and the digest is still SHA-512("abc").
import { Sha512, sha512 } from "nish/crypto/sha512";

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
  const data: u8[] = [0x61, 0x62, 0x63];
  const off: i32 = 2147483647;
  const len: i32 = 1;
  const h = new Sha512();
  console.log("hashing data[2^31 - 1 .. 2^31) of a 3-byte buffer");
  console.log(`accepted: ${h.update(data, off, len)}`);
  h.update(data, 0, 3);
  console.log(`digest is SHA-512("abc"): ${same(h.digest(), sha512(data))}`);
  return 0;
};
