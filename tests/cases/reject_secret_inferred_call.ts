// #613: an unannotated `const` is judged as an annotated one: `keep` answers
// the array `Store` keeps, so `secret(keep(s))` would leave a second name.
import { secret, wipe } from "nish:secret";
class Store {
  buf: u8[];
  constructor() {
    this.buf = [1, 2, 3];
  }
}
const keep = (s: Store): u8[] => s.buf;
export const main = (): i32 => {
  const s = new Store();
  const key = secret(keep(s));
  wipe(key);
  return toI32(s.buf[0]);
};
