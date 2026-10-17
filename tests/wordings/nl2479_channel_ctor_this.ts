// NL2479, C4: a constructor of a class that holds a channel uses `this` only through its own fields.
import { Channel, scope } from "nish/threads";

class Pipe {
  ch: Channel<i32>;
  n: i32;

  constructor(ch: Channel<i32>, n: i32) {
    this.ch = ch;
    this.n = n;
    remember(this);
  }
}

const remember = (p: Pipe): void => {
  p.n = p.n + 1;
};

const produce = (p: Pipe): i32 => {
  p.ch.send(p.n);
  return p.n;
};

export const main = (): i32 => {
  const out: i32[] = [0];
  const ch = new Channel<i32>();
  {
    using s = scope();
    s.spawn(produce, new Pipe(ch, 3), out, 0);
  }
  return out[0];
};
