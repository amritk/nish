// The shared-write rule follows calls: `viaBump` writes nothing itself, but it
// calls `bump`, which does, and the diagnostic names the callee.
import { parallelMapInto } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const bump = (c: Counter): i32 => {
  c.n = c.n + 1;
  return c.n;
};

const viaBump = (c: Counter): i32 => bump(c);

export const main = (): i32 => {
  const cs: Counter[] = [new Counter(), new Counter()];
  const out: i32[] = [0, 0];
  parallelMapInto(cs, out, viaBump);
  return out[0];
};
