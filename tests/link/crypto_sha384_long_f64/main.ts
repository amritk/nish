// `sha384` of an array longer than 2^31 - 1 bytes hashes all of it. Under
// `--number-mode f64` a length is exact but `toI32` of it saturates at
// 2^31 - 1, so a hasher that took its length through `toI32` would answer the
// digest of a prefix: one answer for every message sharing it, which is a
// collision. `sha384` walks a longer array with a `number` offset instead. The
// expected digest of 2^31 zero bytes is Python's `hashlib.sha384`.
// docs/security/crypto-k1.md, finding K1-1.
import { sha384 } from "nish/crypto/sha512";

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
  const message: u8[] = new Array<u8>(n);
  console.log("a 2^31-byte message");
  console.log(hex(sha384(message)));
  return 0;
};
