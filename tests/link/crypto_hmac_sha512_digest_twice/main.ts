// `HmacSha512.digest` ends the computation, as `HmacSha256`'s does: a second
// one panics in the inner `Sha512` ("sha512: digest taken twice", on stderr)
// rather than answering a tag of nothing the caller sent. The first digest
// wipes both hashers and leaves them finished, so the wipe must not have made
// the hasher look fresh again: exit 1, and stdout stops at the line printed
// after the first digest.
import { HmacSha512 } from "nish/crypto/hmac";

export const main = (): i32 => {
  const key: u8[] = [1, 2, 3];
  const data: u8[] = [97, 98, 99];
  const start: i32 = 0;
  const mac = new HmacSha512(key);
  mac.update(data, start, toI32(data.length));
  console.log(`first tag: ${toI32(mac.digest().length)} bytes`);
  const again: u8[] = mac.digest();
  console.log(`unreachable: a second digest answered ${toI32(again.length)} bytes`);
  return 0;
};
