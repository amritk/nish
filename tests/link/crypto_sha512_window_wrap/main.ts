// A window at an offset of 2^31 - 1 panics (exit 1), whatever its length: the
// end `off + len` would wrap in an `i32`, and `Sha512.update` compares `off`
// with `size - len` instead, which cannot. Nothing is printed after the line
// before the misuse.
import { Sha512 } from "nish/crypto/sha512";

export const main = (): i32 => {
  const data: u8[] = [0x61, 0x62, 0x63];
  const off: i32 = 2147483647;
  const len: i32 = 1;
  const h = new Sha512();
  console.log("hashing data[2^31 - 1 .. 2^31) of a 3-byte buffer");
  h.update(data, off, len);
  console.log("unreachable: a window whose end wraps was accepted");
  return 0;
};
