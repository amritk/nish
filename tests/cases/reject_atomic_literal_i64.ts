// The same refusal for `AtomicI64`, reached through a return type.
import { AtomicI64 } from "nish/threads";
const make = (): AtomicI64 => ({ value: toI64(5) });
export const main = (): i32 => {
  const a = make();
  return toI32(a.load());
};
