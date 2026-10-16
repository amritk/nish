// A constructor is a call: one that keeps its argument holds the array, and one
// that hands `this` out of itself leaves its new object with a second name.
import { Secret, secret, wipe } from "nish:secret";
class Holder {
  buf: u8[];
  constructor(b: u8[]) {
    this.buf = b;
  }
}
class Registry {
  last: Pair | null;
  constructor() {
    this.last = null;
  }
}
class Pair {
  lo: u32;
  hi: u32;
  constructor(r: Registry) {
    this.lo = 1;
    this.hi = 2;
    r.last = this;
  }
}
const kept = (): i32 => {
  const raw: u8[] = [1, 2, 3];
  const h = new Holder(raw);
  const key: Secret<u8[]> = secret(raw);
  wipe(key);
  return toI32(h.buf[0]);
};
const handedOut = (): i32 => {
  const r = new Registry();
  const key: Secret<Pair> = secret(new Pair(r));
  wipe(key);
  return 0;
};
export const main = (): i32 => kept() + handedOut();
