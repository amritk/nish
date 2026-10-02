// A window whose `off + len` passes 2^31 - 1 panics (exit 1). Summed in an
// `i32`, 1 + (2^31 - 1) wraps to a negative end that a check written as
// `off + len > size` would let through; `Sha256.update` compares `len` with
// `size - off` instead, which cannot wrap. Nothing is printed after the line
// before the misuse.
import { Sha256 } from "nish/crypto/sha256";

export const main = (): i32 => {
  const data: u8[] = [97, 98, 99];
  const off: i32 = 1;
  const len: i32 = 2147483647;
  const h: Sha256 = new Sha256();
  console.log("hashing data[1 .. 2^31) of a 3-byte buffer");
  h.update(data, off, len);
  console.log("unreachable: a window whose end wraps was accepted");
  return 0;
};
