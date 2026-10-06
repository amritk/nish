// A key window that runs past its array panics in `HmacSha256Scratch.begin`
// ("HmacSha256Scratch: the key window is outside its array", on stderr)
// rather than keying HMAC with the bytes that are there: a tag under a short
// key looks exactly like a tag under the right one. Exit 1, and nothing on
// stdout after the line printed before the misuse.
import { HmacSha256Scratch } from "nish/crypto/hmac";

export const main = (): i32 => {
  const key: u8[] = [1, 2, 3];
  const mac = new HmacSha256Scratch();
  console.log("keying with key[1 .. 4) of a 3-byte key");
  mac.begin(key, toI32(1), toI32(3));
  console.log("unreachable: an out-of-range key window was accepted");
  return 0;
};
