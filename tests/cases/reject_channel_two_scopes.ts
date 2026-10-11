// C4: one scope's tasks reach a channel, here the two scopes of one `using`.
// Each closes it when it joins, and the second scope's sender would send on a
// closed channel.
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

export const main = (): i32 => {
  const out: i32[] = [0, 0];
  const ch = new Channel<i32>();
  {
    using s = scope(), t = scope();
    s.spawn(consume, new Pipe(ch, 0), out, 0);
    t.spawn(produce, new Pipe(ch, 3), out, 1);
  }
  return out[0];
};
