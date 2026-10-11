// WP29 P3: the parent is the receiver. It sends two values before the scope's
// block, two tasks send a thousand each inside it, and after the join the
// parent drains the channel: the first loop stops after ten values, the second
// takes the rest, and the third finds the channel drained and ends at once.
// The senders' values interleave as the scheduler likes natively, so only
// counts and sums are printed. A second channel, of booleans, would have a
// sender only with more than five arguments, and this run has none: the scope
// still closes it before it joins, so the loop over it ends instead of waiting.
import { Channel, scope } from "nish/threads";

class Burst {
  ch: Channel<i32>;
  base: i32;

  constructor(ch: Channel<i32>, base: i32) {
    this.ch = ch;
    this.base = base;
  }
}

class Flags {
  ch: Channel<boolean>;

  constructor(ch: Channel<boolean>) {
    this.ch = ch;
  }
}

const burst = (b: Burst): i32 => {
  for (let i: i32 = 0; i < 1000; i++) {
    b.ch.send(b.base + i);
  }
  return 1000;
};

const raise = (f: Flags): i32 => {
  f.ch.send(true);
  return 1;
};

export const main = (): i32 => {
  const done: i32[] = [0, 0, 0];
  const ch = new Channel<i32>();
  const flags = new Channel<boolean>();
  ch.send(-1);
  ch.send(-2);
  {
    using s = scope();
    s.spawn(burst, new Burst(ch, 0), done, 0);
    s.spawn(burst, new Burst(ch, 1000000), done, 1);
    if (process.argv.length > 5) {
      s.spawn(raise, new Flags(flags), done, 2);
    }
  }
  let sum: i32 = 0;
  let first: i32 = 0;
  for (const x of ch) {
    sum = sum + x;
    first = first + 1;
    if (first === 10) {
      break;
    }
  }
  let rest: i32 = 0;
  for (const x of ch) {
    sum = sum + x;
    rest = rest + 1;
  }
  let after: i32 = 0;
  for (const x of ch) {
    after = after + 1 + x;
  }
  let raised: i32 = 0;
  for (const b of flags) {
    raised = raised + (b ? 1 : 0);
  }
  console.log(`${first} + ${rest} values summing to ${sum}; then ${after}; ${raised} raised; ${done[0] + done[1] + done[2]} sent`);
  return 0;
};
