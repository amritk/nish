// `Sha256.digest` writes the padding into the hasher's own block, so an
// `update` after it would hash that padding as message and answer a digest
// that matches nothing. It absorbs nothing and answers `false` instead, and a
// second `digest` answers the first one again. Without the finished check the
// update would answer `true` and the second digest would differ. A caller that
// has to keep going takes a `copy()` first, which `tests/link/crypto_sha256`
// checks.
import { Sha256 } from "nish/crypto/sha256";

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
  const start: i32 = 0;
  const h: Sha256 = new Sha256();
  h.update(data, start, toI32(data.length));
  const first: u8[] = h.digest();
  console.log(`digest: ${toI32(first.length)} bytes`);
  const fed: boolean = h.update(data, start, toI32(data.length));
  console.log(`update after digest: ${fed}`);
  console.log(`second digest is the first: ${same(h.digest(), first)}`);
  return 0;
};
