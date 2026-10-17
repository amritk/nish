// NL2479, C4: a `spawn` hands its task only a channel the spawning function declared.
import { Channel, scope } from "nish/threads";

class Pipe {
  ch: Channel<i32>;

  constructor(ch: Channel<i32>) {
    this.ch = ch;
  }
}

const produce = (p: Pipe): i32 => {
  p.ch.send(1);
  return 1;
};

const run = (ch: Channel<i32>): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(produce, new Pipe(ch), out, 0);
  }
  return out[0];
};

export const main = (): i32 => {
  const ch = new Channel<i32>();
  return run(ch);
};
