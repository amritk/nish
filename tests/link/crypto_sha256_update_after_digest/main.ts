// `Sha256.digest` writes the padding into the hasher's own block, so an
// `update` after it would hash that padding as message and answer a digest
// that matches nothing. It panics instead: exit 1, and nothing on stdout after
// the line printed before the misuse. A caller that has to keep going takes a
// `copy()` first, which `tests/link/crypto_sha256` checks.
import { Sha256 } from "nish/crypto/sha256";

export const main = (): i32 => {
  const data: u8[] = [97, 98, 99];
  const start: i32 = 0;
  const h: Sha256 = new Sha256();
  h.update(data, start, toI32(data.length));
  console.log(`digest: ${toI32(h.digest().length)} bytes`);
  h.update(data, start, toI32(data.length));
  console.log("unreachable: update after digest returned");
  return 0;
};
