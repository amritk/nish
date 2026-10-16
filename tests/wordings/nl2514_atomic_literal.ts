// NL2514: an atomic is made only by `new`; an object literal would be a plain
// record under Node, with none of the atomic's methods.
import { AtomicI32 } from "nish/threads";

export const main = (): i32 => {
  const a: AtomicI32 = { value: 0 };
  return a.load();
};
