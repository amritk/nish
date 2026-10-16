// R7 is by type, so an atomic a function returns is the same atomic.
import { AtomicI32, scope } from "nish/threads";
class Box {
  a: AtomicI32;
  constructor() {
    this.a = new AtomicI32(0);
  }
  get(): AtomicI32 {
    return this.a;
  }
}
const bump = (b: Box): i32 => b.get().add(1);
export const main = (): i32 => {
  const b = new Box();
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(bump, b, done, 0);
    b.get().add(1);
  }
  return b.a.load();
};
