// `HmacSha256.digest` ends the computation: the inner hash has taken its padding,
// so more message after it would be hashed as though it followed the padding.
// A later `update` panics in the inner `Sha256` ("Sha256: update after digest",
// on stderr): exit 1, and stdout stops at the line printed after the digest.
// The link harness compares stdout and the exit code only, so the message is
// named here rather than pinned.
import { HmacSha256 } from "nish/crypto/hmac";

export const main = (): i32 => {
  const key: u8[] = [1, 2, 3];
  const data: u8[] = [97, 98, 99];
  const start: i32 = 0;
  const mac = new HmacSha256(key);
  mac.update(data, start, toI32(data.length));
  console.log(`tag: ${toI32(mac.digest().length)} bytes`);
  mac.update(data, start, toI32(data.length));
  console.log("unreachable: an update after digest was accepted");
  return 0;
};
