// NL2508: an arrow given to `spawn` assigns to a name it captures.
import { scope } from "nish/threads";

export const main = (): i32 => {
  const n: i32 = 3;
  {
    using s = scope();
    s.spawn(() => {
      n = 4;
    });
  }
  return n;
};
