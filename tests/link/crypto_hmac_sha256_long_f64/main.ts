// `hmacSha256` of an array longer than 2^31 - 1 bytes panics (exit 1) before it
// hashes anything. Under `--number-mode f64` a length is exact, but `toI32` of
// it saturates at 2^31 - 1, so without the check this answered the tag of
// the first 2^31 - 1 bytes: one answer for every message sharing them, which
// is a collision, and for a MAC a forgery: the tag of the prefix verifies
// every longer message that starts with it. The array is zero-filled and
// never read on the path that panics; docs/security/crypto-k1.md, K1-1.
import { hmacSha256 } from "nish/crypto/hmac";

export const main = (): i32 => {
  const n: number = 2147483648;
  const message: u8[] = new Array<u8>(n);
  console.log("a 2^31-byte message");
  const out: u8[] = hmacSha256([toU8(1), toU8(2)], message);
  console.log(`unreachable: ${out.length} bytes of the tag of a prefix`);
  return 0;
};
