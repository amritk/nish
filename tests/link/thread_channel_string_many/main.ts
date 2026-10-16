// A million strings through one `Channel<string>`. Each `send` copies its
// string out of the sender's arena in time that grows with the string alone,
// not with the arena, which holds every string the sender has built so far:
// a send that asked whether the arena held the string walked all its chunks,
// and the program took a minute instead of a second. `tests/run.js` times
// this binary.
import { Channel, scope } from "nish/threads";

class Source {
  out: Channel<string>;
  n: i32;

  constructor(out: Channel<string>, n: i32) {
    this.out = out;
    this.n = n;
  }
}

// Every string sent is kept too, so the sender's arena grows with the sends.
const produce = (src: Source): i32 => {
  const sent: string[] = [];
  for (let i = 0; i < src.n; i++) {
    const t = `s${i}`;
    sent.push(t);
    src.out.send(t);
  }
  return sent.length;
};

const consume = (inp: Channel<string>): i32 => {
  let sum = 0;
  for (const s of inp) {
    sum = (sum + s.length * 31 + s.charCodeAt(s.length - 1)) % 1000003;
  }
  return sum;
};

export const main = (): i32 => {
  const ch = new Channel<string>();
  const out: i32[] = [0, 0];
  {
    using s = scope();
    s.spawn(produce, new Source(ch, 1000000), out, 0);
    s.spawn(consume, ch, out, 1);
  }
  console.log(`${out[0]} ${out[1]}`);
  return 0;
};
