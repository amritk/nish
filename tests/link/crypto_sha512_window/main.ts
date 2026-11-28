// A window outside its buffer is refused before any of it is hashed: `update`
// answers `false` and absorbs nothing. A negative length is the case only
// that check catches: every index it would read is in range, so without the
// check it would quietly shorten the count of bytes hashed and the digest
// would not be SHA-512("bc").
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
  const tail: u8[] = [0x62, 0x63];
  const h = new Sha512();
  console.log(`in bounds: ${h.update(data, 1, 2)}`);
  console.log(`a negative length: ${h.update(data, 1, -1)}`);
  console.log(`digest is SHA-512("bc"): ${same(h.digest(), sha512(tail))}`);
  return 0;
};
