// A method sees its receiver as `this`: one that keeps `this` holds the record,
// and one that answers a field answers what its object still holds.
import { Secret, secret, wipe } from "nish:secret";
class Registry {
  last: Pair | null;
  constructor() {
    this.last = null;
  }
}
class Pair {
  lo: u32;
  hi: u32;
  constructor() {
    this.lo = 1;
    this.hi = 2;
  }
  enrol(r: Registry): void {
    r.last = this;
  }
}
class Holder {
  buf: u8[];
  constructor() {
    this.buf = [7];
  }
  bytes(): u8[] {
    return this.buf;
  }
}
const enrolled = (): i32 => {
  const r = new Registry();
  const raw = new Pair();
  raw.enrol(r);
  const key: Secret<Pair> = secret(raw);
  wipe(key);
  return 0;
};
const field = (): i32 => {
  const h = new Holder();
  const key: Secret<u8[]> = secret(h.bytes());
  wipe(key);
  return toI32(h.buf[0]);
};
export const main = (): i32 => enrolled() + field();
