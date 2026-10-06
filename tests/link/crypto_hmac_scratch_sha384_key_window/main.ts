// A negative key window panics in `HmacSha384Scratch.begin`
// ("HmacSha384Scratch: the key window is outside its array", on stderr), as
// `HmacSha256Scratch` does. Exit 1, and nothing on stdout after the line
// printed before the misuse.
import { HmacSha384Scratch } from "nish/crypto/hmac";

export const main = (): i32 => {
  const key: u8[] = [1, 2, 3];
  const mac = new HmacSha384Scratch();
  console.log("keying with key[-1 .. 2)");
  mac.begin(key, toI32(-1), toI32(3));
  console.log("unreachable: an out-of-range key window was accepted");
  return 0;
};
