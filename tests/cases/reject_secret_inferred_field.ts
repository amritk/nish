// #613: an unannotated `const` is judged as an annotated one: a field's owner
// keeps the plain bytes, so `secret(h.buf)` is refused.
import { secret, wipe } from "nish:secret";
class Holder {
  buf: u8[];
  constructor() {
    this.buf = [1, 2, 3];
  }
}
export const main = (): i32 => {
  const h = new Holder();
  const key = secret(h.buf);
  wipe(key);
  return 0;
};
