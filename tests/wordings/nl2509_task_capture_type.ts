// NL2509: an arrow given to `spawn` reads a local whose type a task cannot
// capture: here a `Channel`, which reaches a task through its argument.
import { Channel, scope } from "nish/threads";

export const main = (): i32 => {
  const ch = new Channel<i32>();
  {
    using s = scope();
    s.spawn(() => {
      ch.send(1);
    });
  }
  return 0;
};
