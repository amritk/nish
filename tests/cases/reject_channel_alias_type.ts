// C2: a type alias is the type it names, and `Channel<T> | null` holds a
// channel other than as itself.
import { Channel, scope } from "nish/threads";

type MaybeChannel = Channel<i32> | null;

export const main = (): i32 => {
  const c: MaybeChannel = null;
  return c === null ? 0 : 1;
};
