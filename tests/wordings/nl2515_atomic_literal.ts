// NL2515: a class of `nish/threads` is made only as the module makes it; an
// object literal would be a plain record under Node, with none of its methods.
import { AtomicI32 } from "nish/threads";

export const main = (): i32 => {
  const a: AtomicI32 = { value: 0 };
  return a.load();
};
