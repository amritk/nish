// A task may wipe a `Secret` it makes from a fresh value, but not one made
// from a call's answer: what a call answers may be anyone's memory.
import { secret, wipe } from "nish:secret";
import { scope } from "nish/threads";
const make = (n: i32): u8[] => {
  const xs = new Array<u8>(n);
  xs.fill(9);
  return xs;
};
const clear = (n: i32): i32 => {
  const k = secret(make(n));
  wipe(k);
  return 0;
};
export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(clear, 4, out, 0);
  }
  return out[0];
};
