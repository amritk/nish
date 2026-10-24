// A task may not wipe a `Secret` it made with `secret(...)`: `secret` keeps its
// value, so the storage is not one the task allocated, and the wipe is a write
// another thread could see.
import { secret, wipe } from "nish:secret";
import { scope } from "nish/threads";
const clear = (n: i32): i32 => {
  const k = secret([toU8(n), toU8(2)]);
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
