// C6: no task both sends and receives on one channel, here sending through a
// constructor a `new` runs: a `new` is a call, and its sends are the task's.
import { Channel, scope } from "nish/threads";

class Pipe {
  ch: Channel<i32>;

  constructor(ch: Channel<i32>) {
    this.ch = ch;
  }
}

const sendOne = (p: Pipe): i32 => {
  p.ch.send(1);
  return 1;
};

class Ticket {
  sent: i32;

  constructor(p: Pipe) {
    this.sent = sendOne(p);
  }
}

const echo = (p: Pipe): i32 => {
  const t = new Ticket(p);
  let sum: i32 = t.sent;
  for (const x of p.ch) {
    sum = sum + x;
  }
  return sum;
};

export const main = (): i32 => {
  const out: i32[] = [0];
  const ch = new Channel<i32>();
  {
    using s = scope();
    s.spawn(echo, new Pipe(ch), out, 0);
  }
  return out[0];
};
