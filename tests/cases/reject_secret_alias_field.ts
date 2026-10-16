// A field that holds the array, stored into an object or written in a literal,
// is a second reference `secret(raw)` cannot move.
import { Secret, secret, wipe } from "nish:secret";
class Holder {
  buf: u8[];
  constructor() {
    this.buf = [];
  }
}
interface Box {
  buf: u8[];
}
const stored = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  const h = new Holder();
  h.buf = raw;
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(h.buf[0]);
};
const literal = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  const b: Box = { buf: raw };
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(b.buf[0]);
};
export const main = (): i32 => stored() + literal();
