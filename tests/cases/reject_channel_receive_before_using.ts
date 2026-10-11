// C5: the parent receives only after the join, so not before the `using` in
// the scope's own block either: natively nothing has sent yet, and it waits.
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
  const sent: i32[] = [0];
  const ch = new Channel<i32>();
  let got: i32 = 0;
  {
    for (const x of ch) {
      got = got + x;
    }
    using s = scope();
    s.spawn(produce, new Pipe(ch, 5), sent, 0);
  }
  return got;
};
