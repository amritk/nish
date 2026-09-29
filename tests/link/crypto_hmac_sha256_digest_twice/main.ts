// A second `HmacSha256.digest` would pad an already padded inner hash and answer
// a tag of nothing the caller sent. It panics in the inner `Sha256` instead
// ("Sha256: digest called twice", on stderr): exit 1, and stdout stops at the line
// printed after the first digest. The link harness compares stdout and the
// exit code only, so the message is named here rather than pinned.
import { HmacSha256 } from "nish/crypto/hmac";

export const main = (): i32 => {
  const key: u8[] = [1, 2, 3];
  const data: u8[] = [97, 98, 99];
  const start: i32 = 0;
  const mac = new HmacSha256(key);
  mac.update(data, start, toI32(data.length));
  console.log(`first tag: ${toI32(mac.digest().length)} bytes`);
  const again: u8[] = mac.digest();
  console.log(`unreachable: a second digest answered ${toI32(again.length)} bytes`);
  return 0;
};
