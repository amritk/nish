// `HmacSha256.digest` ends the computation: the inner hash has taken its padding,
// so more message after it would be hashed as though it followed the padding.
// A later `update` absorbs nothing and answers `false`, and the tag already
// taken is hmacSha256(key, "abc"). Without the check the inner hash would take the
// bytes after its padding.
import { HmacSha256, hmacSha256 } from "nish/crypto/hmac";

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
  const mac = new HmacSha256(key);
  mac.update(data, start, toI32(data.length));
  const tag: u8[] = mac.digest();
  console.log(`accepted after the tag: ${mac.update(data, start, toI32(data.length))}`);
  console.log(`tag is hmacSha256(key, "abc"): ${same(tag, hmacSha256(key, data))}`);
  return 0;
};
