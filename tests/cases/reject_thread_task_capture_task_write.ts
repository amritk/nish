// A task writes nothing another can see except through a guard: a store
// through a captured array is a store into memory its caller owns.
import { scope } from "nish/threads";

export const main = (): i32 => {
  const xs: i32[] = [1, 2];
  {
    using s = scope();
    s.spawn(() => {
      xs[0] = 5;
    });
  }
  return xs[0];
};
