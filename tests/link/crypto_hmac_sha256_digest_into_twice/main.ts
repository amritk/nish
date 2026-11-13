// A second `HmacSha256.digestInto` would pad an already padded inner hash and
// write a tag of nothing the caller sent. It panics in the inner `Sha256`
// instead ("Sha256: digest called twice", on stderr): exit 1, and stdout stops
// at the line printed after the first one. The link harness compares stdout
// and the exit code only, so the message is named here rather than pinned.
import { HmacSha256 } from "nish/crypto/hmac";

export const main = (): i32 => {
  const key: u8[] = [1, 2, 3];
  const data: u8[] = [97, 98, 99];
  const start: i32 = 0;
  const mac = new HmacSha256(key);
  mac.update(data, start, toI32(data.length));
  const out: u8[] = new Array<u8>(32);
  mac.digestInto(out, start);
  console.log("first tag written");
  mac.digestInto(out, start);
  console.log("unreachable: a second digestInto was accepted");
  return 0;
};
