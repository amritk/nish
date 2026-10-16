// An atomic's method is called, never taken as a value.
import { AtomicI64 } from "nish/threads";
export const main = (): i32 => {
  const a = new AtomicI64(0);
  const f = a.add;
  f(1);
  return 0;
};
