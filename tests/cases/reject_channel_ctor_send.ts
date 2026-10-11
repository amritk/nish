// C2: a constructor uses a channel it is handed only to set a field from it.
// A send there runs in the parent at the `spawn`, inside the scope's block.
import { Channel, scope } from "nish/threads";

class Pipe {
  ch: Channel<i32>;

  constructor(ch: Channel<i32>) {
    this.ch = ch;
    this.ch.send(7);
  }
}

const one = (p: Pipe): i32 => 1;

export const main = (): i32 => {
  const out: i32[] = [0];
  const ch = new Channel<i32>();
  {
    using s = scope();
    s.spawn(one, new Pipe(ch), out, 0);
  }
  return out[0];
};
