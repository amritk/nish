// NL2513: an atomic's word is reached only through its methods, each one
// indivisible; a plain read would race with a task's update.
import { AtomicI32 } from "nish/threads";

export const main = (): i32 => {
  const a = new AtomicI32(0);
  return a.value;
};
