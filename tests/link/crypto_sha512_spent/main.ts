// A hasher is spent once it has answered its digest: a later `update` would
// hash onto a state that padding has already closed, so it absorbs nothing
// and answers `false`, and the digest stays the one answered. Without the
// finished check the update would answer `true` and the digest would move.
import { Sha384 } from "nish/crypto/sha512";

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
  const h = new Sha384();
  h.update(data, 0, 3);
  const first: u8[] = h.digest();
  console.log(`digest: ${first.length} bytes`);
  console.log(`update after digest: ${h.update(data, 0, 3)}`);
  console.log(`digest is unchanged: ${same(h.digest(), first)}`);
  return 0;
};
