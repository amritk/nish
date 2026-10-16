// R7 follows the task's argument into a `Map`'s values.
import { AtomicI32, scope } from "nish/threads";
class Box {
  m: Map<string, AtomicI32>;
  constructor() {
    this.m = new Map<string, AtomicI32>();
  }
}
const bump = (b: Box): i32 => {
  const a = b.m.get("x");
  return a === undefined ? 0 : a.add(1);
};
export const main = (): i32 => {
  const b = new Box();
  const a = new AtomicI32(0);
  b.m.set("x", a);
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(bump, b, done, 0);
    a.add(1);
  }
  return a.load();
};
