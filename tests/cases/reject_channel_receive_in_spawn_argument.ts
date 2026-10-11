// C5: a `spawn`'s argument is the parent's code, evaluated at the spawn, so a
// receive there is the parent receiving inside the scope's block.
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

const drain = (ch: Channel<i32>): i32 => {
  let sum: i32 = 0;
  for (const x of ch) {
    sum = sum + x;
  }
  return sum;
};

const twice = (n: i32): i32 => n * 2;

export const main = (): i32 => {
  const out: i32[] = [0, 0];
  const ch = new Channel<i32>();
  {
    using s = scope();
    s.spawn(produce, new Pipe(ch, 5), out, 0);
    s.spawn(twice, drain(ch), out, 1);
  }
  return out[1];
};
