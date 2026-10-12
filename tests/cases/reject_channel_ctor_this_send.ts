// #567: a read of `this`'s own field is admitted only when nothing reached
// from it can send; the channel field itself can, and a send from here is one
// the sender count never sees.
import { Channel, scope } from "nish/threads";

class Late {
  ch: Channel<i32>;

  constructor(ch: Channel<i32>) {
    this.ch = ch;
    this.ch.send(-1);
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
