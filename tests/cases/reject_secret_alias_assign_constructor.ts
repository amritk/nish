// An assignment handed to a constructor that keeps its parameter leaves its
// array in the new object.
import { Secret, secret, wipe } from "nish:secret";
class Holder {
  buf: u8[];
  constructor(b: u8[]) {
    this.buf = b;
  }
}
export const main = (): i32 => {
  let raw: u8[] = [9];
  const h = new Holder((raw = [1, 2, 3]));
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(h.buf[0]);
};
