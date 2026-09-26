// A task may write nothing another task or its caller can see: the tasks of a
// scope run at once, and `bump` writes a field of the object it is handed.
import { scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const bump = (c: Counter): i32 => {
  c.n = c.n + 1;
  return c.n;
};

export const main = (): i32 => {
  const c = new Counter();
  const out: i32[] = [0, 0];
  {
    using s = scope();
    s.spawn(bump, c, out, 0);
    s.spawn(bump, c, out, 1);
  }
  return out[0];
};
