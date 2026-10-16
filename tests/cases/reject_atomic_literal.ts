// An object literal typed as an atomic: natively it would be the word, under
// Node a record with no `load`, so only `new AtomicI32(v)` makes one.
import { AtomicI32 } from "nish/threads";
export const main = (): i32 => {
  const a: AtomicI32 = { value: 5 };
  return a.load();
};
