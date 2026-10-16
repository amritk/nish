// R7 covers a capture: the arrow task reaches `a` without an argument.
import { AtomicI32, scope } from "nish/threads";
export const main = (): i32 => {
  const a = new AtomicI32(0);
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn((n: i32): i32 => a.add(n), 1, done, 0);
    a.add(2);
  }
  return a.load();
};
