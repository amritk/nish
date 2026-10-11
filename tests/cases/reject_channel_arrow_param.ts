// The arrow rule covers a parameter whose type holds a channel, here one that
// may be `null` and is never used: an arrow names no channel type at all.
import { Channel } from "nish/threads";

const run = (f: (c: Channel<i32> | null) => i32): i32 => f(null);

export const main = (): i32 => run((c: Channel<i32> | null): i32 => 1);
