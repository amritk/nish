// NL2511: a `spawn` without a destination is given an entry that answers a
// value, which nothing would store.
import { scope } from "nish/threads";

const twice = (n: i32): i32 => n * 2;

export const main = (): i32 => {
  {
    using s = scope();
    s.spawn(twice, 4);
  }
  return 0;
};
