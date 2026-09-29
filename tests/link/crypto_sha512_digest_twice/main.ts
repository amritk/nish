// `digest` closes the hasher: it writes the padding into the hasher's own block
// and compresses it into the state. A second `digest` would pad that state
// again and answer a digest of nothing in particular, so it panics instead:
// exit 1, and nothing on stdout after the line printed before the misuse.
// Without the check this program would print its "unreachable" line and exit 0.
// A caller that needs the digest twice keeps the array, or takes a `copy()` first.
import { Sha512 } from "nish/crypto/sha512";

export const main = (): i32 => {
  const data: u8[] = [0x61, 0x62, 0x63];
  const h = new Sha512();
  h.update(data, 0, 3);
  console.log(`digest: ${h.digest().length} bytes`);
  const again = h.digest();
  console.log(`unreachable: a second digest answered ${again.length} bytes`);
  return 0;
};
