// A tag window that runs past its array is refused by `HmacSha256Scratch.finishInto`
// rather than writing part of the tag: it answers `false` and writes nothing.
// The computation is left as it was, so a `finishInto` into a window that fits
// writes hmacSha256(key, "abc"). Without the check the write would run off the
// array.
import { HmacSha256Scratch, hmacSha256 } from "nish/crypto/hmac";

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
  const key: u8[] = [1, 2, 3];
  const data: u8[] = [97, 98, 99];
  const start: i32 = 0;
  const tag: u8[] = new Array<u8>(40);
  const mac = new HmacSha256Scratch();
  mac.begin(key, start, toI32(key.length));
  mac.update(data, start, toI32(data.length));
  console.log("writing a 32-byte tag at tag[9] of 40 bytes");
  console.log(`tag written: ${mac.finishInto(tag, toI32(9))}`);
  const out: u8[] = new Array<u8>(32);
  console.log(`tag written: ${mac.finishInto(out, start)}`);
  console.log(`tag is hmacSha256(key, "abc"): ${same(out, hmacSha256(key, data))}`);
  return 0;
};
