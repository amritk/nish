// A `parallelMapInto` body may write nothing its caller can see: every thread
// runs it at once, and `bump` writes a field of the object it is handed.
import { parallelMapInto } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const bump = (c: Counter): i32 => {
  c.n = c.n + 1;
  return c.n;
};

export const main = (): i32 => {
  const cs: Counter[] = [new Counter(), new Counter()];
  const out: i32[] = [0, 0];
  parallelMapInto(cs, out, bump);
  return out[0];
};
