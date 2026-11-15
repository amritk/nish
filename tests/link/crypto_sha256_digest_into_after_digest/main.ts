// `Sha256.digestInto` after `digest` panics ("Sha256: digest called twice", on
// stderr): the hasher's block already holds the padding, so a second digest
// would match nothing. Exit 1, and stdout stops at the line printed before the
// misuse.
import { Sha256 } from "nish/crypto/sha256";

export const main = (): i32 => {
  const data: u8[] = [97, 98, 99];
  const start: i32 = 0;
  const h: Sha256 = new Sha256();
  h.update(data, start, toI32(data.length));
  console.log(`digest: ${toI32(h.digest().length)} bytes`);
  const out: u8[] = new Array<u8>(32);
  h.digestInto(out, start);
  console.log("unreachable: digestInto after digest returned");
  return 0;
};
