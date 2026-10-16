// R7 sees through `new`: a constructor is a call, and `Bumper`'s updates the
// atomic the task reaches.
import { AtomicI32, scope } from "nish/threads";
class Bumper {
  seen: i32;
  constructor(a: AtomicI32) {
    this.seen = a.add(1);
  }
}
const bump = (a: AtomicI32): i32 => a.add(1);
export const main = (): i32 => {
  const a = new AtomicI32(0);
  const done: i32[] = [0];
  let seen: i32 = 0;
  {
    using s = scope();
    s.spawn(bump, a, done, 0);
    seen = new Bumper(a).seen;
  }
  return seen;
};
