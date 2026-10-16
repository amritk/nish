// R7 walks a generic's instantiated field: `Cell<AtomicI32>.v`.
import { AtomicI32, scope } from "nish/threads";
class Cell<T> {
  v: T;
  constructor(v: T) {
    this.v = v;
  }
}
const bump = (c: Cell<AtomicI32>): i32 => c.v.add(1);
export const main = (): i32 => {
  const c = new Cell<AtomicI32>(new AtomicI32(0));
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(bump, c, done, 0);
    c.v.add(1);
  }
  return c.v.load();
};
