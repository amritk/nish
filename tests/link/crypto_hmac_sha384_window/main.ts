// A window that runs past the end of its buffer is refused rather than
// authenticating the bytes that are there: a tag over a short read looks exactly
// like a tag over the right bytes, so `HmacSha384.update` absorbs none of it and
// answers `false`. The computation is left as it was, so the tag is
// hmacSha384(key, "abc"). Without the check the window would be read short and the
// tag would differ.
import { HmacSha384, hmacSha384 } from "nish/crypto/hmac";

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
  const off: i32 = 1;
  const len: i32 = 3;
  const start: i32 = 0;
  const mac = new HmacSha384(key);
  console.log("authenticating data[1 .. 4) of a 3-byte buffer");
  console.log(`accepted: ${mac.update(data, off, len)}`);
  mac.update(data, start, toI32(data.length));
  console.log(`tag is hmacSha384(key, "abc"): ${same(mac.digest(), hmacSha384(key, data))}`);
  return 0;
};
