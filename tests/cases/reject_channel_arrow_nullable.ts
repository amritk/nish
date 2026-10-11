// The arrow rule covers a channel that may be `null`, as the type rule would
// in a top-level function: an arrow uses no channel at all.
import { Channel, scope } from "nish/threads";

const run = (f: (k: i32) => i32): i32 => f(1);

export const main = (): i32 =>
  run((k: i32): i32 => {
    const c: Channel<i32> | null = null;
    return c === null ? k : 0;
  });
