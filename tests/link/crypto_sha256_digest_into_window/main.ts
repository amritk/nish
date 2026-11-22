// A digest window that runs past the end of its array: `Sha256.digestInto` answers `false` before anything is written and
// leaves the hasher as it was, rather than writing the part of the digest that
// fits: the array stays zero, and a `digest` afterwards is the message's.
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
  const at: i32 = 1;
  const h: Sha256 = new Sha256();
  h.update(data, start, toI32(data.length));
  const out: u8[] = new Array<u8>(32);
  console.log("writing a digest at out[1 .. 33) of a 32-byte array");
  const wrote: boolean = h.digestInto(out, at);
  console.log(`wrote: ${wrote}`);
  console.log(`out:   ${hex(out)}`);
  console.log(`then:  ${hex(h.digest())}`);
  return 0;
};
