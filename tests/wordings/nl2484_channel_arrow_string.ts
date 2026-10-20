// NL2484, C2: the remedy is built from the arrow it refuses, so a task that
// sends strings is told to write a function that takes a `Channel<string>`.
import { Channel, scope } from "nish/threads";

export const main = (): i32 => {
  const ch = new Channel<string>();
  {
    using s = scope();
    s.spawn((c: Channel<string>): void => { c.send("hi"); }, ch);
  }
  for (const x of ch) {
    console.log(x);
  }
  return 0;
};
