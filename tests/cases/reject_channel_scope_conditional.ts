// C2: a channel is declared beside its scope, with no condition between: a
// scope inside an `if` might not run, and nothing would close the channel.
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
  if (out.length > 1) {
    using s = scope();
    s.spawn(produce, new Pipe(ch, 3), out, 0);
    s.spawn(consume, new Pipe(ch, 0), out, 1);
  }
  return out[1];
};
