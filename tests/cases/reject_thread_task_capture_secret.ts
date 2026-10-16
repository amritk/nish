// A `Secret` is read only inside `expose`, and a task cannot capture one.
import { scope } from "nish/threads";
import { secret, wipe } from "nish:secret";

const count = (n: i32): i32 => n;

export const main = (): i32 => {
  const key = secret([1, 2, 3]);
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn((n: i32): i32 => count(n) + (key === key ? 1 : 0), 1, out, 0);
  }
  wipe(key);
  return out[0];
};
