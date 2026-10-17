// NL2479, C4: a channel is reachable from the tasks of one scope only.
import { Channel, scope } from "nish/threads";

const produce = (ch: Channel<i32>): i32 => {
  ch.send(1);
  return 1;
};

export const main = (): i32 => {
  const one: i32[] = [0];
  const two: i32[] = [0];
  const ch = new Channel<i32>();
  {
    using a = scope();
    a.spawn(produce, ch, one, 0);
  }
  {
    using b = scope();
    b.spawn(produce, ch, two, 0);
  }
  return one[0] + two[0];
};
