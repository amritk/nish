// C4: after the join a channel may only be received on, here through a call:
// every sender has returned, so the channel is closed.
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

const top = (ch: Channel<i32>): void => {
  ch.send(1);
};

export const main = (): i32 => {
  const out: i32[] = [0];
  const ch = new Channel<i32>();
  {
    using s = scope();
    s.spawn(produce, new Pipe(ch, 3), out, 0);
  }
  top(ch);
  let sum: i32 = 0;
  for (const x of ch) {
    sum = sum + x;
  }
  return sum;
};
