// A helper's write through a `Secret` it is handed is judged by what the task
// hands it: handed a `Secret` a call answered (`const k = make(n)`), the write
// is to memory the task's caller may see, and NL2471 names the helper, before
// the `wipe`. Handed one the task made, the same helper is admitted
// (`tests/link/thread_task_wipe_secret`, `cleared`).
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
