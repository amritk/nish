// A guard is only ever named as `g.value` inside its own block, and a task
// cannot capture one.
import { Mutex, scope } from "nish/threads";

class Tally {
  total: i32 = 0;
}

const bump = (n: i32): i32 => n + 1;

export const main = (): i32 => {
  const m = new Mutex<Tally>(new Tally());
  const out: i32[] = [0];
  using g = m.lock();
  {
    using s = scope();
    s.spawn((n: i32): i32 => bump(n) + g.value.total, 1, out, 0);
  }
  return out[0];
};
