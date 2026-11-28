// A tag window that runs past its array is refused by `HmacSha384Scratch.finishInto`
// rather than writing part of the tag: it answers `false` and writes nothing.
// The computation is left as it was, so a `finishInto` into a window that fits
// writes hmacSha384(key, "abc"). Without the check the write would run off the
// array.
import { HmacSha384Scratch, hmacSha384 } from "nish/crypto/hmac";

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
  const tag: u8[] = new Array<u8>(47);
  const mac = new HmacSha384Scratch();
  mac.begin(key, start, toI32(key.length));
  mac.update(data, start, toI32(data.length));
  console.log("writing a 48-byte tag into 47 bytes");
  console.log(`tag written: ${mac.finishInto(tag, toI32(0))}`);
  const out: u8[] = new Array<u8>(48);
  console.log(`tag written: ${mac.finishInto(out, start)}`);
  console.log(`tag is hmacSha384(key, "abc"): ${same(out, hmacSha384(key, data))}`);
  return 0;
};
