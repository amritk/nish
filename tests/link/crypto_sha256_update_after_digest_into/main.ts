// `Sha256.digestInto` finishes the hasher as `digest` does, so an `update`
// after it absorbs nothing and answers `false`, and the digest stays the one
// written. Without the finished check the update would answer `true` and the
// digest taken after it would differ.
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
  const out: u8[] = new Array<u8>(32);
  h.digestInto(out, start);
  console.log("digestInto: done");
  const fed: boolean = h.update(data, start, toI32(data.length));
  console.log(`update after digestInto: ${fed}`);
  console.log(`digest is unchanged: ${same(h.digest(), out)}`);
  return 0;
};
