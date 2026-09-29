// A window that runs past the end of its buffer panics in the inner
// `Sha256.update` ("Sha256: the window is outside the buffer", on stderr) rather
// than authenticating the bytes that are there: a tag over a short read looks
// exactly like a tag over the right bytes. Exit 1, and nothing on stdout after
// the line printed before the misuse.
import { HmacSha256 } from "nish/crypto/hmac";

export const main = (): i32 => {
  const key: u8[] = [1, 2, 3];
  const data: u8[] = [97, 98, 99];
  const off: i32 = 1;
  const len: i32 = 3;
  const mac = new HmacSha256(key);
  console.log("authenticating data[1 .. 4) of a 3-byte buffer");
  mac.update(data, off, len);
  console.log("unreachable: an out-of-range window was accepted");
  return 0;
};
