// `sha1` of an array longer than 2^31 - 1 bytes hashes all of it. Under
// `--number-mode f64` a length is exact but `toI32` of it saturates at
// 2^31 - 1, so a hasher that took its length through `toI32` would answer the
// digest of a prefix; `sha1` walks the array with a `number` offset instead.
// The expected digest of 2^31 zero bytes is Python's `hashlib.sha1`.
// docs/security/crypto-k1.md, finding K1-1.
import { sha1 } from "nish/crypto/sha1";

const HEX_DIGITS: string = "0123456789abcdef";

export const main = (): i32 => {
  const n: number = 2147483648;
  const message: u8[] = new Array<u8>(n);
  console.log("a 2^31-byte message");
  const out: u8[] = sha1(message);
  const parts: string[] = [];
  for (const b of out) {
    const v: i32 = toI32(b);
    parts.push(HEX_DIGITS.substring(v >> 4, (v >> 4) + 1));
    parts.push(HEX_DIGITS.substring(v & 15, (v & 15) + 1));
  }
  console.log(parts.join(""));
  return 0;
};
