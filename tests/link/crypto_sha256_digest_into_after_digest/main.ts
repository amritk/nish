// `Sha256.digestInto` after `digest` writes the same digest again and answers
// `true`: the hasher's hash value already is the digest, so nothing is padded
// twice.
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
  console.log(`digest:     ${hex(h.digest())}`);
  const out: u8[] = new Array<u8>(32);
  const wrote: boolean = h.digestInto(out, start);
  console.log(`digestInto: ${hex(out)} ${wrote}`);
  return 0;
};
