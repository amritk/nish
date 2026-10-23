// The reverse order: `direct` is checked with this module, so its call
// reaches `Wrap$i32` with its methods before `main.ts` hands `take` one as a
// type argument.
import { wrap } from "./lib";

export const direct = (): i32 => {
  const w = wrap(9);
  return w.b.get();
};

export const take = <T>(v: T): i32 => 1;
