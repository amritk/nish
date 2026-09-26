// A task may not move the arena: the first task of a scope runs on the thread
// that opened it, in that thread's arena, which a reset would rewind.
import { scope } from "nish/threads";

const wipe = (n: i32): i32 => {
  Arena.reset();
  return n;
};

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(wipe, 1, out, 0);
  }
  return out[0];
};
