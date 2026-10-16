// A function the array is handed to may keep it, by storing its parameter or by
// returning it: the facts say so, and `secret(raw)` cannot move what it kept.
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
const pass = (b: u8[]): u8[] => b;
const stored = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  const h = new Holder();
  keep(h, raw);
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(h.buf[0]);
};
const returned = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  const back = pass(raw);
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(back.length);
};
export const main = (): i32 => stored() + returned();
