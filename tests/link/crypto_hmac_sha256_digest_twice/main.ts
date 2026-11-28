// A second `HmacSha256.digest` would feed the outer hash a second inner digest
// and answer a tag of nothing the caller sent. It panics instead
// ("HmacSha256: the tag is already taken", on stderr): exit 1, and stdout stops
// at the line printed after the first digest. expected.stderr pins the message,
// so another guard firing fails the test.
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
