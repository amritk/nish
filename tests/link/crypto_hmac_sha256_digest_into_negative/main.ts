// A tag window that starts before its array panics in `HmacSha256.digestInto`
// ("HmacSha256: the tag window is outside its array", on stderr) rather than
// writing below `out`. Exit 1, and stdout stops at the line printed before the
// misuse.
import { HmacSha256 } from "nish/crypto/hmac";

export const main = (): i32 => {
  const key: u8[] = [1, 2, 3];
  const data: u8[] = [97, 98, 99];
  const start: i32 = 0;
  const before: i32 = -1;
  const mac = new HmacSha256(key);
  mac.update(data, start, toI32(data.length));
  const out: u8[] = new Array<u8>(64);
  console.log("writing a tag at offset -1");
  mac.digestInto(out, before);
  console.log("unreachable: a negative tag offset was accepted");
  return 0;
};
