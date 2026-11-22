// `Sha256.digest` folds the padding into the hasher's hash value, which is
// then the digest itself. A `copy` taken afterwards is a finished hasher with
// that same hash value, so its `digest` answers the same 32 bytes rather than
// a digest of a padded message. The copy that goes on hashing is the one taken
// *before* `digest`, which `tests/link/crypto_sha256` checks.
import { Sha256 } from "nish/crypto/sha256";

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
  const data: u8[] = [97, 98, 99];
  const start: i32 = 0;
  const h: Sha256 = new Sha256();
  h.update(data, start, toI32(data.length));
  console.log(`digest: ${hex(h.digest())}`);
  const twin: Sha256 = h.copy();
  console.log(`copy:   ${hex(twin.digest())}`);
  return 0;
};
