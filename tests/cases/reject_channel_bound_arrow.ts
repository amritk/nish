// C2: a channel is never bound to a second name, inside an arrow too: the
// arrow is lifted into a function of its own, and is held to the rule its
// body would be.
import { Channel, scope } from "nish/threads";

class Pipe {
  ch: Channel<i32>;

  constructor(ch: Channel<i32>) {
    this.ch = ch;
  }
}

const apply = <T>(x: T, f: (x: T) => i32): i32 => f(x);

const relay = (p: Pipe): i32 =>
  apply(p, (q: Pipe): i32 => {
    const c = q.ch;
    c.send(1);
    return 1;
  });

export const main = (): i32 => {
  const out: i32[] = [0];
  const ch = new Channel<i32>();
  {
    using s = scope();
    s.spawn(relay, new Pipe(ch), out, 0);
  }
  let sum: i32 = 0;
  for (const x of ch) {
    sum = sum + x;
  }
  return sum + out[0];
};
