// A window outside its buffer panics (exit 1) before any of it is hashed. A
// negative length is the case only that check catches: every index it would
// read is in range, so without the check it would quietly shorten the count of
// bytes hashed and answer a wrong digest.
import { Sha512 } from "nish/crypto/sha512";

export const main = (): i32 => {
  const data: u8[] = [0x61, 0x62, 0x63];
  const h = new Sha512();
  h.update(data, 1, 2);
  console.log("in bounds: accepted");
  h.update(data, 1, -1);
  console.log("unreachable: a negative length was accepted");
  return 0;
};
