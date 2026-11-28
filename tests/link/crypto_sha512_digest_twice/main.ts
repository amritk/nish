// `digest` closes the hasher: it writes the padding into the hasher's own block
// and compresses it into the state. A second `digest` answers the same digest
// rather than padding that state again: without the finished check it would
// answer a digest of nothing in particular, and this program would print
// `false`.
import { Sha512 } from "nish/crypto/sha512";

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
  const h = new Sha512();
  h.update(data, 0, 3);
  const first: u8[] = h.digest();
  console.log(`digest: ${first.length} bytes`);
  console.log(`second digest is the first: ${same(h.digest(), first)}`);
  return 0;
};
