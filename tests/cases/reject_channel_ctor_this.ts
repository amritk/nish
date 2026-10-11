// C4: the constructor of a class that holds a channel calls no method of
// `this` and hands `this` to nothing: what it sends that way would be a send
// the sender count never saw, and the channel could close before it.
import { Channel, scope } from "nish/threads";

class Late {
  ch: Channel<i32>;

  constructor(ch: Channel<i32>) {
    this.ch = ch;
    this.push();
  }

  push(): void {
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
