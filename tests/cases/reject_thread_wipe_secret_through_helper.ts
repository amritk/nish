// A task may write a `Secret` it makes, but a helper that writes the
// `Secret` it is handed writes whatever its caller passes: handed a `Secret`
// a call answered, the write is to memory the task's caller can see.
import { Secret, exposeWith, secret, wipe } from "nish:secret";
import { scope } from "nish/threads";
const zero = (k: u8[], v: i32): i32 => {
  k.fill(toU8(v));
  return 0;
};
const clearSecret = (k: Secret<u8[]>): i32 => exposeWith(k, 0, zero);
const make = (n: i32): Secret<u8[]> => {
  const k = secret(new Array<u8>(n));
  return k;
};
const clear = (n: i32): i32 => {
  const k = make(n);
  clearSecret(k);
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
