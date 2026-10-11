// C2: a constructor uses a channel it is handed only to set a field from it:
// bound to another name there, it could go anywhere the checker cannot follow.
import { Channel, scope } from "nish/threads";

class Pipe {
  ch: Channel<i32>;

  constructor(ch: Channel<i32>) {
    this.ch = ch;
    const kept = ch;
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
