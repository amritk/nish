// A store through either arm of a `?:` is judged as a store into whatever the
// expression may be: one arm is the task's own array and the other its
// argument's, so the store is a shared write. (`??`, the other operator that
// answers one of its operands, is only legal on a `Map`'s `get`, whose probe
// is a write of its own, so no program isolates it the way this one does.)
import { scope } from "nish/threads";

class Holder {
  xs: i32[];

  constructor() {
    this.xs = [0, 0];
  }
}

const poke = (h: Holder): i32 => {
  const xs = new Array<i32>(4);
  (h.xs.length > 0 ? xs : h.xs)[0] = 1;
  return xs[0];
};

export const main = (): i32 => {
  const h = new Holder();
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(poke, h, out, 0);
  }
  return out[0];
};
