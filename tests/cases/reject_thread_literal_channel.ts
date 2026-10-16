// A `Channel` written as an object literal: natively a runtime handle, under
// Node a record with no queue methods, so only `new Channel()` makes one.
import { Channel } from "nish/threads";
export const main = (): i32 => {
  const q: i32[] = [];
  const c: Channel<i32> = { queue: q, head: 0, state: toI64(0) };
  return 0;
};
