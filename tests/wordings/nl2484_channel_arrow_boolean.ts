// NL2484, C2: an arrow over a `Channel<boolean>` is refused with a module
// function over the same element type and the arrow's own body.
import { Channel, scope } from "nish/threads";

const count = (): i32 => {
  const ch = new Channel<boolean>();
  {
    using s = scope();
    s.spawn((out: Channel<boolean>): void => { out.send(true); out.send(false); }, ch);
  }
  let n: i32 = 0;
  for (const x of ch) {
    if (x) {
      n = n + 1;
    }
  }
  return n;
};

export const main = (): i32 => {
  console.log(count());
  return 0;
};
