// `Sha256.digest` pads the message in the hasher's own block and folds that
// padding into the hash value, which is then the digest. A second `digest`
// pads nothing again: it answers the same 32 bytes. A caller that needs a
// digest and more input takes a `copy()` first.
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
  console.log(`first:  ${hex(h.digest())}`);
  console.log(`second: ${hex(h.digest())}`);
  return 0;
};
