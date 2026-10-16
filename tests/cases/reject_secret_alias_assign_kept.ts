// An assignment handed to a function that keeps its parameter leaves its array
// with the function.
import { Secret, secret, wipe } from "nish:secret";
class Holder {
  buf: u8[];
  constructor() {
    this.buf = [];
  }
}
const keep = (h: Holder, b: u8[]): void => {
  h.buf = b;
};
export const main = (): i32 => {
  let raw: u8[] = [9];
  const h = new Holder();
  keep(h, raw = [1, 2, 3]);
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(h.buf[0]);
};
