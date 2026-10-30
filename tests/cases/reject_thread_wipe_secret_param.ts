// A task may wipe a `Secret` it makes from a fresh value, but not one made
// from a parameter: `secret(key)` would wrap the caller's array, so the wipe
// would zero memory the caller can see. `secret`'s sole-reference rule refuses
// it before NL2471 is asked.
import { secret, wipe } from "nish:secret";
import { scope } from "nish/threads";
const clear = (key: u8[]): i32 => {
  const k = secret(key);
  wipe(k);
  return 0;
};
export const main = (): i32 => {
  const key: u8[] = [toU8(7), toU8(2)];
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(clear, key, out, 0);
  }
  return out[0];
};
