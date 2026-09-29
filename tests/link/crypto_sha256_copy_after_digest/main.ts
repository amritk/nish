// `Sha256.digest` folds the padding into the hasher's hash value, so a `copy`
// taken afterwards would start a second hasher from a padded message and
// answer digests of nothing the caller sent. It panics instead ("Sha256: copy
// after digest", on stderr): exit 1, and stdout stops at the line printed
// after the digest. The link harness compares stdout and the exit code only,
// so the message is named here rather than pinned. The copy that works is
// the one taken *before* `digest`, which `tests/link/crypto_sha256` checks.
import { Sha256 } from "nish/crypto/sha256";

export const main = (): i32 => {
  const data: u8[] = [97, 98, 99];
  const start: i32 = 0;
  const h: Sha256 = new Sha256();
  h.update(data, start, toI32(data.length));
  console.log(`digest: ${toI32(h.digest().length)} bytes`);
  const twin: Sha256 = h.copy();
  console.log(`unreachable: a copy after digest answered ${toI32(twin.digest().length)} bytes`);
  return 0;
};
