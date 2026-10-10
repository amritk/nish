// An HMAC key longer than 2^31 - 1 bytes panics (exit 1) before it is hashed.
// Under `--number-mode f64` its length is exact but `toI32` of it saturates,
// so hashing `toI32(key.length)` bytes would key the MAC with a prefix of the
// key: two keys sharing it would answer one tag. The key used to reach
// `sha256`'s own check; since the constructor hashes it in a hasher it wipes
// (#476), the check is HMAC's. The array is zero-filled and never read on the
// path that panics; docs/security/crypto-k1.md, K1-1.
import { hmacSha256 } from "nish/crypto/hmac";

export const main = (): i32 => {
  const n: number = 2147483648;
  const key: u8[] = new Array<u8>(n);
  console.log("a 2^31-byte key");
  const out: u8[] = hmacSha256(key, [toU8(1), toU8(2)]);
  console.log(`unreachable: ${out.length} bytes of a tag under a prefix of the key`);
  return 0;
};
