// WP29 P3: three tasks send on one channel and a fourth, spawned after them,
// receives. How the senders' values interleave is the scheduler's natively and
// spawn order under Node, so the receiver answers only what does not depend on
// it: the sum of every value, each `i * 1000000 + 1`, whose low digits count
// them. The channel carries `f64`s, whose bits travel in its 8-byte slots,
// and every partial sum is an integer below 2^53, so the order they are added
// in cannot change a bit of the answer.
// The third sender is spawned from a loop, which a sender may be.
import { Channel, scope } from "nish/threads";

class Range {
  ch: Channel<f64>;
  from: i32;
  to: i32;

  constructor(ch: Channel<f64>, from: i32, to: i32) {
    this.ch = ch;
    this.from = from;
    this.to = to;
  }
}

const sendRange = (r: Range): i32 => {
  for (let i: i32 = r.from; i < r.to; i++) {
    r.ch.send(toF64(i) * 1000000.0 + 1.0);
  }
  return r.to - r.from;
};

const tally = (ch: Channel<f64>): f64 => {
  let sum: f64 = 0.0;
  for (const x of ch) {
    sum = sum + x;
  }
  return sum;
};

export const main = (): i32 => {
  const sent: i32[] = [0, 0, 0];
  const got: f64[] = [0.0];
  const ch = new Channel<f64>();
  {
    using s = scope();
    s.spawn(sendRange, new Range(ch, 0, 20000), sent, 0);
    s.spawn(sendRange, new Range(ch, 20000, 30000), sent, 1);
    for (let k: i32 = 2; k < 3; k++) {
      s.spawn(sendRange, new Range(ch, 30000, 45000), sent, k);
    }
    s.spawn(tally, ch, got, 0);
  }
  console.log(`sent ${sent[0] + sent[1] + sent[2]}, received ${got[0]}`);
  return 0;
};
