// C2: `ready` is part of what a channel means under Node or of the runtime's
// handle on it, and no member of a channel but `send` may be named.
import { Channel, scope } from "nish/threads";

class Pipe {
  ch: Channel<i32>;
  n: i32;

  constructor(ch: Channel<i32>, n: i32) {
    this.ch = ch;
    this.n = n;
  }
}

const produce = (p: Pipe): i32 => {
  for (let i: i32 = 1; i <= p.n; i++) {
    p.ch.send(i);
  }
  return p.n;
};

const consume = (p: Pipe): i32 => {
  let sum: i32 = 0;
  for (const x of p.ch) {
    sum = sum + x;
  }
  return sum;
};

const peek = (p: Pipe): i32 => {
  const v = p.ch.ready() ? 1 : 0;
  return v;
};

export const main = (): i32 => {
  const out: i32[] = [0];
  const ch = new Channel<i32>();
  {
    using s = scope();
    s.spawn(peek, new Pipe(ch, 1), out, 0);
  }
  return out[0];
};
