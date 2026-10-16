// Inside a helper, an assignment used as a value gives the array the helper
// returns a second name, which the helper keeps in an object it was handed.
import { Secret, secret, wipe } from "nish:secret";
class Holder {
  buf: u8[];
  constructor() {
    this.buf = [];
  }
}
const make = (h: Holder): u8[] => {
  let out: u8[] = [9];
  h.buf = (out = [1, 2, 3]);
  return out;
};
export const main = (): i32 => {
  const h = new Holder();
  const key: Secret<u8[]> = secret(make(h));
  wipe(key);
  return toI32(h.buf[0]);
};
