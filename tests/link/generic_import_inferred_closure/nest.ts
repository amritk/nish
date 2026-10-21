// `Wrap<Wrap<i32>>`: the same template twice in one closure.
import { nest } from "./lib";

export const viaNest = <T>(v: T): i32 => {
  const n = nest(9);
  return n.b.get().b.get();
};
