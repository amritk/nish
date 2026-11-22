// `hmacSha256` of a key longer than 2^31 - 1 bytes hashes all of the key, which HMAC hashes to 32 bytes first,.
// Under `--number-mode f64` a length is exact but `toI32` of it saturates at
// 2^31 - 1, so a key taken through `toI32` would be cut to a prefix; the
// hasher walks a longer array with a `number` offset instead. The expected tag
// over 2^31 zero bytes is Python's `hmac.new(key, bytes([1, 2]), hashlib.sha256)`.
// docs/security/crypto-k1.md, finding K1-1.
import { hmacSha256 } from "nish/crypto/hmac";

const HEX_DIGITS: string = "0123456789abcdef";

const hex = (bytes: u8[]): string => {
  const parts: string[] = [];
  for (const b of bytes) {
    const v: i32 = toI32(b);
    parts.push(HEX_DIGITS.substring(v >> 4, (v >> 4) + 1));
    parts.push(HEX_DIGITS.substring(v & 15, (v & 15) + 1));
  }
  return parts.join("");
};

export const main = (): i32 => {
  const n: number = 2147483648;
  const key: u8[] = new Array<u8>(n);
  console.log("a 2^31-byte key");
  console.log(hex(hmacSha256(key, [toU8(1), toU8(2)])));
  return 0;
};
