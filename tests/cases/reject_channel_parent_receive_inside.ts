// C5: inside a scope's block the parent receives nothing, here through a call:
// natively the tasks have not run, so it would wait for a send that never comes.
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

export const main = (): i32 => {
  const out: i32[] = [0];
  const ch = new Channel<i32>();
  let sum: i32 = 0;
  {
    using s = scope();
    s.spawn(produce, new Pipe(ch, 3), out, 0);
    sum = drain(ch);
  }
  return sum;
};
