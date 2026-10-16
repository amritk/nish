// R7 covers every declarator of a declaration, not only the first.
import { AtomicI32, scope } from "nish/threads";
const bump = (a: AtomicI32): i32 => a.add(1);
export const main = (): i32 => {
  const a = new AtomicI32(0);
  const done: i32[] = [0];
  let total: i32 = 0;
  {
    using s = scope();
    s.spawn(bump, a, done, 0);
    const x: i32 = 1,
      y: i32 = a.compareExchange(0, 7);
    total = x + y;
  }
  return total;
};
