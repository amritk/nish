// #567: a store into `this`'s own field is admitted, and what it stores is
// judged on its own: `this.self = this` keeps a second way to `this` in a
// field any later holder of the object could send through.
import { Channel, scope } from "nish/threads";

class Late {
  ch: Channel<i32>;
  self: Late | null = null;

  constructor(ch: Channel<i32>) {
    this.ch = ch;
    this.self = this;
  }
}

const take = (l: Late): i32 => {
  let last: i32 = 0;
  for (const x of l.ch) {
    last = x;
  }
  return last;
};

export const main = (): i32 => {
  const out: i32[] = [0];
  const ch = new Channel<i32>();
  {
    using s = scope();
    s.spawn(take, new Late(ch), out, 0);
  }
  return out[0];
};
