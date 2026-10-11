// #567, `this` out of its constructor: a store into a field of the object a
// field holds is admitted only when that object cannot reach a channel, and
// `Box` can, through the `Late` it holds: storing `this` there hands it on.
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
