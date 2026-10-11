// C7: nothing receives while a lock is held, here a loop over a channel written
// in the guard's block: it waits, and the lock's holder must not.
import { Channel, Mutex, scope } from "nish/threads";

class Tally {
  n: i32 = 0;
}

class Job {
  ch: Channel<i32>;
  tally: Mutex<Tally>;

  constructor(ch: Channel<i32>, tally: Mutex<Tally>) {
    this.ch = ch;
    this.tally = tally;
  }
}

const count = (j: Job): i32 => {
  using g = j.tally.lock();
  for (const x of j.ch) {
    g.value.n = g.value.n + x;
  }
  return g.value.n;
};

export const main = (): i32 => {
  const out: i32[] = [0];
  const ch = new Channel<i32>();
  const tally = new Mutex<Tally>(new Tally());
  ch.send(4);
  {
    using s = scope();
    s.spawn(count, new Job(ch, tally), out, 0);
  }
  return out[0];
};
