// `Wrap<i32>` arrives as `gen`'s type argument, then `wrap(9)`: `Box$i32.get`
// is reached through a field.
import { wrap } from "./lib";

export const viaField = <T>(v: T): i32 => {
  const w = wrap(9);
  return w.b.get();
};
