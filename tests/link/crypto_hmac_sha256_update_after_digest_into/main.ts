// `HmacSha256.digestInto` ends the computation as `digest` does: a later
// `update` panics in the inner `Sha256` ("Sha256: update after digest", on
// stderr) rather than hashing message after the padding. Exit 1, and stdout
// stops at the line printed after the tag. expected.stderr
// pins the message, so another guard firing fails the test.
import { HmacSha256 } from "nish/crypto/hmac";

export const main = (): i32 => {
  const key: u8[] = [1, 2, 3];
  const data: u8[] = [97, 98, 99];
  const start: i32 = 0;
  const mac = new HmacSha256(key);
  mac.update(data, start, toI32(data.length));
  const out: u8[] = new Array<u8>(32);
  mac.digestInto(out, start);
  console.log("tag written");
  mac.update(data, start, toI32(data.length));
  console.log("unreachable: an update after digestInto was accepted");
  return 0;
};
