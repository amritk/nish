// `sha384` of an array longer than 2^31 - 1 bytes panics (exit 1) before it
// hashes anything. Under `--number-mode f64` a length is exact, but `toI32` of
// it saturates at 2^31 - 1, so without the check this answered the digest of
// the first 2^31 - 1 bytes: one answer for every message sharing them, which
// is a collision. The array is zero-filled and never read on the path
// that panics; docs/security/crypto-k1.md, finding K1-1.
import { sha384 } from "nish/crypto/sha512";

export const main = (): i32 => {
  const n: number = 2147483648;
  const message: u8[] = new Array<u8>(n);
  console.log("a 2^31-byte message");
  const out: u8[] = sha384(message);
  console.log(`unreachable: ${out.length} bytes of the digest of a prefix`);
  return 0;
};
