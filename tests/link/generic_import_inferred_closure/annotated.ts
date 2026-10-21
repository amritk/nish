// The annotated form takes the same path once `Wrap` is named.
import { Wrap, wrap } from "./lib";

export const viaAnnotation = <T>(v: T): i32 => {
  const w: Wrap<i32> = wrap(9);
  return w.b.get();
};
