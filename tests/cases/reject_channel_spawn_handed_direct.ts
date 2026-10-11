// C4: the same rule as `reject_channel_spawn_handed`, for a task handed the
// channel itself rather than a carrier built around it.
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

const send1 = (ch: Channel<i32>): i32 => {
  ch.send(1);
  return 1;
};

const relay = (ch: Channel<i32>): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(send1, ch, out, 0);
  }
  return out[0];
};

export const main = (): i32 => {
  const out: i32[] = [0, 0];
  const ch = new Channel<i32>();
  {
    using s = scope();
    s.spawn(produce, new Pipe(ch, 3), out, 0);
    s.spawn(consume, new Pipe(ch, 0), out, 1);
  }
  return out[1] + relay(ch);
};
