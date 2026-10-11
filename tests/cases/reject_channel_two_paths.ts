// C2: one channel reaches a task by one path. Here it is both fields of the
// argument, so the task could receive on one while it sends on the other.
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

class Pipe2 {
  a: Channel<i32>;
  b: Channel<i32>;

  constructor(a: Channel<i32>, b: Channel<i32>) {
    this.a = a;
    this.b = b;
  }
}

const both = (p: Pipe2): i32 => {
  p.b.send(1);
  let sum: i32 = 0;
  for (const x of p.a) {
    sum = sum + x;
  }
  return sum;
};

export const main = (): i32 => {
  const out: i32[] = [0];
  const ch = new Channel<i32>();
  {
    using s = scope();
    s.spawn(both, new Pipe2(ch, ch), out, 0);
  }
  return out[0];
};
