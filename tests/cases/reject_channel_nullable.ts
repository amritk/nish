// C2: a channel reaches a task as its argument or a field of it, and never
// one that may be `null`: the `spawn` counts a sender by reading the channel
// out of the argument, and a sender it could not read would close the channel
// before it had sent.
import { Channel, scope } from "nish/threads";

class Pipe {
  ch: Channel<i32> | null;

  constructor(ch: Channel<i32>) {
    this.ch = ch;
  }
}

const produce = (p: Pipe): i32 => {
  const ch = p.ch;
  if (ch !== null) {
    ch.send(1);
  }
  return 1;
};

export const main = (): i32 => {
  const out: i32[] = [0];
  const ch = new Channel<i32>();
  {
    using s = scope();
    s.spawn(produce, new Pipe(ch), out, 0);
  }
  let sum: i32 = 0;
  for (const x of ch) {
    sum = sum + x;
  }
  return sum + out[0];
};
