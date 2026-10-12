// C4 through a `?.` chain: `snd?.push(ch, 7)` sends on the scope's channel inside
// the block that holds its spawns, which a plain call is refused for.
import { Channel, scope } from "nish/threads";

class Pipe {
  ch: Channel<i32>;
  n: i32;

  constructor(ch: Channel<i32>, n: i32) {
    this.ch = ch;
    this.n = n;
  }
}

class Sender {
  push(ch: Channel<i32>, v: i32): i32 {
    ch.send(v);
    return v;
  }
}

const consume = (p: Pipe): i32 => {
  let sum: i32 = 0;
  for (const x of p.ch) {
    sum = sum + x;
  }
  return sum;
};

export const main = (): i32 => {
  const out: i32[] = [0];
  const ch = new Channel<i32>();
  const snd: Sender | null = new Sender();
  {
    using s = scope();
    s.spawn(consume, new Pipe(ch, 0), out, 0);
    const sent = snd?.push(ch, 7) ?? 0;
    console.log(`${sent}`);
  }
  return out[0];
};
