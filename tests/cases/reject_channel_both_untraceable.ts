// C6: a task that reaches a channel through a name the checker cannot follow,
// here a second name for its argument, counts as using every channel it holds:
// `relay` only receives on `ch` directly, and is refused for both, by name.
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
const relay = (p: Pipe): i32 => {
  const q = p;
  q.ch.send(1);
  return consume(p);
};

export const main = (): i32 => {
  const out: i32[] = [0];
  const ch = new Channel<i32>();
  {
    using s = scope();
    s.spawn(relay, new Pipe(ch, 0), out, 0);
  }
  return out[0];
};
