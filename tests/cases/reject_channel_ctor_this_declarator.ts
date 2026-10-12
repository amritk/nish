// #567, every declarator: the first binds a field read the rule admits, the
// second binds `this` itself to a second name, which it does not.
import { Channel, scope } from "nish/threads";

class Late {
  ch: Channel<i32>;
  n: i32 = 4;

  constructor(ch: Channel<i32>) {
    this.ch = ch;
    const n = this.n,
      me = this;
    me.n = n + 1;
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
