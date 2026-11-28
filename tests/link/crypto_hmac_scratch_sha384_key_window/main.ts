// A key window that runs past its array is refused by `HmacSha384Scratch.begin`
// rather than keying HMAC with the bytes that are there: a tag under a short
// key looks exactly like a tag under the right one. `begin` answers `false`,
// and `finishInto` then writes no tag (it answers `false` too) until a `begin`
// succeeds. After a good `begin` the tag is hmacSha384(key, "abc"). Without the
// checks the short key would be used and the tag would differ.
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
  const tag: u8[] = new Array<u8>(48);
  const mac = new HmacSha384Scratch();
  console.log("keying with key[-1 .. 2)");
  console.log(`keyed: ${mac.begin(key, toI32(-1), toI32(3))}`);
  console.log(`tag written: ${mac.finishInto(tag, start)}`);
  console.log(`keyed: ${mac.begin(key, start, toI32(key.length))}`);
  mac.update(data, start, toI32(data.length));
  console.log(`tag written: ${mac.finishInto(tag, start)}`);
  console.log(`tag is hmacSha384(key, "abc"): ${same(tag, hmacSha384(key, data))}`);
  return 0;
};
