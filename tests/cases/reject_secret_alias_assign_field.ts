// An assignment stored into a field leaves its array in the object.
import { Secret, secret, wipe } from "nish:secret";
class Holder {
  buf: u8[];
  constructor() {
    this.buf = [];
  }
}
export const main = (): i32 => {
  let raw: u8[] = [9];
  const h = new Holder();
  h.buf = (raw = [1, 2, 3]);
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(h.buf[0]);
};
