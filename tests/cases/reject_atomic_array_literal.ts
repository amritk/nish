// An object literal typed as an atomic array: natively it would be the buffer,
// under Node a record with no `add`, so only `new AtomicI32Array(n)` makes one.
import { AtomicI32Array } from "nish/threads";
export const main = (): i32 => {
  const a: AtomicI32Array = { length: 2, values: [0, 0] };
  return a.load(0);
};
