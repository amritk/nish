// A `Channel` written as an object literal in an arrow's return: the
// return type gives the literal its class.
import { Channel } from "nish/threads";
const make = (q: i32[]): Channel<i32> => ({ queue: q, head: 0, state: toI64(0) });
export const main = (): i32 => {
  return 0;
};
