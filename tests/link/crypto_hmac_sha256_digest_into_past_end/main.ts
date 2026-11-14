// A tag window that runs past the end of its array panics in
// `HmacSha256.digestInto` ("HmacSha256: the tag window is outside its array",
// on stderr) before anything is written. Exit 1, and stdout stops at the line
// printed before the misuse.
import { HmacSha256 } from "nish/crypto/hmac";

export const main = (): i32 => {
  const key: u8[] = [1, 2, 3];
  const data: u8[] = [97, 98, 99];
  const start: i32 = 0;
  const late: i32 = 33;
  const mac = new HmacSha256(key);
  mac.update(data, start, toI32(data.length));
  const out: u8[] = new Array<u8>(64);
  console.log("writing a tag at out[33 .. 65) of a 64-byte array");
  mac.digestInto(out, late);
  console.log("unreachable: a tag window past the end was accepted");
  return 0;
};
