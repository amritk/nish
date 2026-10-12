// A constructor is a call inside the task too: `new Bump(b)` writes the object
// the task captured, which is its caller's.
import { scope } from "nish/threads";

interface Box {
  v: i32;
}

class Bump {
  constructor(b: Box) {
    b.v = b.v + 1;
  }
}

export const main = (): i32 => {
  const b: Box = { v: 1 };
  {
    using s = scope();
    s.spawn(() => {
      const bumped = new Bump(b);
    });
  }
  return b.v;
};
