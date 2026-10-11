// #567: a store into a field of what a field holds is admitted only when that
// value neither is a channel nor holds one, two levels deep. `Box` holds a
// `Late`, which holds the channel, so `this.box` is refused as the base of
// `this.box.l = ...` whatever is stored. (A store of `this` itself is pinned
// at its right-hand side by `reject_channel_ctor_this_self`.)
import { Channel, scope } from "nish/threads";

class Box {
  l: Late | null = null;
}

class Late {
  ch: Channel<i32>;
  box: Box;

  constructor(ch: Channel<i32>, box: Box) {
    this.ch = ch;
    this.box = box;
    this.box.l = this;
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
  const box = new Box();
  {
    using s = scope();
    s.spawn(take, new Late(ch, box), out, 0);
  }
  return out[0];
};
