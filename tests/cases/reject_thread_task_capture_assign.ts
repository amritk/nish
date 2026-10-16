// A task's arrow reads a captured value and never writes it.
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
