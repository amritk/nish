// A tag window shorter than the tag panics in `HmacSha256.digestInto`
// ("HmacSha256: the tag window is outside its array", on stderr) before
// anything is written or the hashers are touched: a truncated tag would verify
// against nothing and look like a forgery. Exit 1, and stdout stops at the line
// printed before the misuse.
import { HmacSha256 } from "nish/crypto/hmac";

export const main = (): i32 => {
  const key: u8[] = [1, 2, 3];
  const data: u8[] = [97, 98, 99];
  const start: i32 = 0;
  const mac = new HmacSha256(key);
  mac.update(data, start, toI32(data.length));
  const out: u8[] = new Array<u8>(31);
  console.log("writing a 32-byte tag into a 31-byte array");
  mac.digestInto(out, start);
  console.log("unreachable: a short tag window was accepted");
  return 0;
};
