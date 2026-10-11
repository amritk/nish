// WP29 P3: one task sends 1..50000 on a channel and another sums what it
// receives, on two threads at once. The receiver's loop ends when the sender
// has returned and the channel is drained, so it sees every value: the sum is
// 50000 * 50001 / 2 natively, and under Node, where the sender runs to the end
// at its spawn and the receiver then walks what it sent.
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
  const sums: i32[] = [0];
  const ch = new Channel<i32>();
  {
    using s = scope();
    s.spawn(produce, new Pipe(ch, 50000), sent, 0);
    s.spawn(consume, new Pipe(ch, 0), sums, 0);
  }
  console.log(`${sent[0]} ${sums[0]}`);
  return 0;
};
