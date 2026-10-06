// A tag window that runs past its array panics in `HmacSha256Scratch.finishInto`
// ("HmacSha256Scratch: the tag window is outside its array", on stderr)
// before anything is written, rather than writing the part of the tag that
// fits. Exit 1, and nothing on stdout after the line printed before the misuse.
import { HmacSha256Scratch } from "nish/crypto/hmac";

export const main = (): i32 => {
  const key: u8[] = [1, 2, 3];
  const tag: u8[] = new Array<u8>(40);
  const mac = new HmacSha256Scratch();
  mac.begin(key, toI32(0), toI32(3));
  console.log("writing a 32-byte tag at tag[9] of 40 bytes");
  mac.finishInto(tag, toI32(9));
  console.log("unreachable: an out-of-range tag window was accepted");
  return 0;
};
