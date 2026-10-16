// A task's own array holding its argument `Rng`: `rs[0].nextI32()` steps the
// generator the scope's other task steps too.
import { scope } from "nish/threads";
import { Rng } from "nish/random";

const draw = (shared: Rng): void => {
  const rs: Rng[] = [shared];
  rs[0].nextI32();
};

export const main = (): i32 => {
  const shared = new Rng(7);
  {
    using s = scope();
    s.spawn(draw, shared);
  }
  return shared.nextI32();
};
