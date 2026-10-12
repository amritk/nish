// #567, the `new` route: a constructor is a call, so `this` handed to one
// is `this` handed on, and `Peer` could send through it uncounted.
import { Channel, scope } from "nish/threads";

class Peer {
  l: Late;

  constructor(l: Late) {
    this.l = l;
  }
}

class Late {
  ch: Channel<i32>;
  peer: Peer | null = null;

  constructor(ch: Channel<i32>) {
    this.ch = ch;
    this.peer = new Peer(this);
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
