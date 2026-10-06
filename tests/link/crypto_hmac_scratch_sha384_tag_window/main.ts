// A tag window that runs past its array panics in `HmacSha384Scratch.finishInto`
// ("HmacSha384Scratch: the tag window is outside its array", on stderr), as
// `HmacSha256Scratch` does: 48 bytes do not fit in 47. Exit 1, and nothing on
// stdout after the line printed before the misuse.
import { HmacSha384Scratch } from "nish/crypto/hmac";

export const main = (): i32 => {
  const key: u8[] = [1, 2, 3];
  const tag: u8[] = new Array<u8>(47);
  const mac = new HmacSha384Scratch();
  mac.begin(key, toI32(0), toI32(3));
  console.log("writing a 48-byte tag into 47 bytes");
  mac.finishInto(tag, toI32(0));
  console.log("unreachable: an out-of-range tag window was accepted");
  return 0;
};
