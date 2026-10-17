// NL2475, C1: a channel carries a number, a `boolean`, an enum or a `string`, which
// a send copies in and a receive copies out. An array of strings is a pointer
// into the arena of the task that built it, and its elements are pointers too.
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
  const out: i32[] = [0];
  const ch = new Channel<i32>();
  const words = new Channel<string[]>();
  {
    using s = scope();
    s.spawn(produce, new Pipe(ch, 1), out, 0);
  }
  for (const w of words) {
    console.log(w[0]);
  }
  return out[0];
};
