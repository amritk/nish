// An object literal pushed into an array of nullable atomics: the element
// type, not a declared binding, gives the literal its class.
import { AtomicI32 } from "nish/threads";
export const main = (): i32 => {
  const xs: (AtomicI32 | null)[] = [];
  xs.push({ value: 1 });
  return xs.length;
};
