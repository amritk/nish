// `sha1` of an array longer than 2^31 - 1 bytes panics (exit 1) before it
// hashes anything ("sha1: a message longer than 2^31 - 1 bytes", on stderr).
// Under `--number-mode f64` `toI32` of the length saturates, so without the
// check this would answer the digest of the first 2^31 - 1 bytes, as
// `tests/link/crypto_sha256_long_f64` explains for SHA-256.
import { sha1 } from "nish/crypto/sha1";

export const main = (): i32 => {
  const n: number = 2147483648;
  const message: u8[] = new Array<u8>(n);
  console.log("a 2^31-byte message");
  const out: u8[] = sha1(message);
  console.log(`unreachable: ${out.length} bytes of the digest of a prefix`);
  return 0;
};
