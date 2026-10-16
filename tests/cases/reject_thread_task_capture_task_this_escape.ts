// A constructor run by the task that hands `this` to a captured object stores
// into memory the task's caller owns.
import { scope } from "nish/threads";

class Holder {
  held: Leak | null = null;
}

class Leak {
  v: i32 = 0;

  constructor(h: Holder) {
    h.held = this;
  }
}

export const main = (): i32 => {
  const h = new Holder();
  {
    using s = scope();
    s.spawn(() => {
      const leak = new Leak(h);
    });
  }
  return 0;
};
