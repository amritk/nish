// C1, a helper whose expression body is a channel parameter, `(c) => c`: its
// whole body is its answer, refused as `return c` is, so `pass(c).send(1)`
// cannot carry the channel past the rules that say which tasks reach it.
import { Channel, scope } from "nish/threads";

const recv = (c: Channel<i32>): i32 => {
  let t = 0;
  for (const x of c) {
    t = t + x;
  }
  return t;
};
const pass = (c: Channel<i32>): Channel<i32> => c;
const send = (c: Channel<i32>): void => {
  pass(c).send(1);
};

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    const ch = new Channel<i32>();
    using s = scope();
    s.spawn(send, ch);
    s.spawn(recv, ch, out, 0);
  }
  return out[0];
};
