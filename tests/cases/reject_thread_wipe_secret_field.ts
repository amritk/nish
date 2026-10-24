// A task may wipe a `Secret` it makes from a fresh value, but not one made
// from a field: `secret(b.bytes)` would wrap an array the caller's object
// holds. `secret`'s sole-reference rule refuses it before NL2471 is asked.
import { secret, wipe } from "nish:secret";
import { scope } from "nish/threads";
class Box {
  bytes: u8[];
  constructor() {
    this.bytes = [toU8(7), toU8(2)];
  }
}
const clear = (b: Box): i32 => {
  const k = secret(b.bytes);
  wipe(k);
  return 0;
};
export const main = (): i32 => {
  const b = new Box();
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(clear, b, out, 0);
  }
  return out[0];
};
