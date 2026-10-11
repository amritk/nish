// WP29 P3: a scope gives its channels their close at every exit of its block,
// just before it joins, whether or not any task it ran could send: the end of
// the block, a `return` from inside it, and a `break` that leaves it. With no
// sender spawned the receiver's loop ends at once, and with an early `return`
// the receiver still sees everything, because the join runs before the
// returned value, which reads its answer, is computed. A scope that files no
// task at all still closes its channel, so the parent's loop after it takes
// what the parent sent before it and ends.
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

const sumVia = (n: i32, early: boolean): i32 => {
  const sums: i32[] = [0, 0];
  const ch = new Channel<i32>();
  {
    using s = scope();
    if (n > 0) {
      s.spawn(produce, new Pipe(ch, n), sums, 0);
    }
    s.spawn(consume, new Pipe(ch, 0), sums, 1);
    if (early) {
      return sums[1] + 1000000;
    }
  }
  return sums[1];
};

const rounds = (count: i32): i32 => {
  let total: i32 = 0;
  for (let r: i32 = 0; r < count; r++) {
    const got: i32[] = [0, 0];
    const ch = new Channel<i32>();
    {
      using s = scope();
      s.spawn(produce, new Pipe(ch, r + 1), got, 0);
      s.spawn(consume, new Pipe(ch, 0), got, 1);
      if (r === 3) {
        break;
      }
    }
    total = total + got[1];
  }
  return total;
};

const idle = (n: i32): i32 => {
  const out: i32[] = [0];
  const ch = new Channel<i32>();
  ch.send(n);
  ch.send(n);
  {
    using s = scope();
    if (n < 0) {
      s.spawn(produce, new Pipe(ch, n), out, 0);
    }
  }
  let sum: i32 = 0;
  for (const x of ch) {
    sum = sum + x;
  }
  return sum;
};

export const main = (): i32 => {
  console.log(`${sumVia(100, false)} ${sumVia(0, false)} ${sumVia(10, true)} ${sumVia(0, true)} ${rounds(10)} ${idle(21)}`);
  return 0;
};
