// R7 covers a second `spawn`'s argument, evaluated by the parent in the block.
import { AtomicI32, scope } from "nish/threads";
const bump = (a: AtomicI32): i32 => a.add(1);
const twice = (n: i32): i32 => n * 2;
export const main = (): i32 => {
  const a = new AtomicI32(0);
  const done: i32[] = [0, 0];
  {
    using s = scope();
    s.spawn(bump, a, done, 0);
    s.spawn(twice, a.load(), done, 1);
  }
  return done[1];
};
