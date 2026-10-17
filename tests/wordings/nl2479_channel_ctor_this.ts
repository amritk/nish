// NL2479, C4: a constructor of a class that holds a channel uses `this` only through its own fields.
import { Channel } from "nish/threads";

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

export const main = (): i32 => {
  const ch = new Channel<i32>();
  const p = new Pipe(ch, 3);
  return p.n;
};
