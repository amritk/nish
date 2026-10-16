// A task reaches a channel through its argument, where the scope counts its
// senders; a captured channel would be a sender nobody counted.
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
