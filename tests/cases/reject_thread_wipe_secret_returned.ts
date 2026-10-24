// A task may wipe a `Secret` it makes from a fresh value, but not one a
// helper returns: what a call answers may be anyone's memory, even a
// `Secret` the helper made. Make the `Secret` in the task.
import { Secret, secret, wipe } from "nish:secret";
import { scope } from "nish/threads";
const make = (n: i32): Secret<u8[]> => {
  const k = secret(new Array<u8>(n));
  return k;
};
const clear = (n: i32): i32 => {
  const k = make(n);
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
