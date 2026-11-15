// `Sha256.digestInto` finishes the hasher as `digest` does, so an `update`
// after it panics ("Sha256: update after digest", on stderr). Exit 1, and
// stdout stops at the line printed before the misuse.
import { Sha256 } from "nish/crypto/sha256";

export const main = (): i32 => {
  const data: u8[] = [97, 98, 99];
  const start: i32 = 0;
  const h: Sha256 = new Sha256();
  h.update(data, start, toI32(data.length));
  const out: u8[] = new Array<u8>(32);
  h.digestInto(out, start);
  console.log("digestInto: done");
  h.update(data, start, toI32(data.length));
  console.log("unreachable: update after digestInto returned");
  return 0;
};
