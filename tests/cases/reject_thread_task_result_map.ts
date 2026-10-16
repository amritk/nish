// A task does not answer a `Map`: its entries are in the worker's arena, and
// no copy at the join reaches them, so the parent would read freed memory
// once `churn()` reuses it.
import { scope } from "nish/threads";

const churn = (): i32 => {
  let t = 0;
  for (let i = 0; i < 4000; i++) {
    t = t + `zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz${i}`.length;
  }
  return t;
};

const table = (n: i32): Map<string, i32> => {
  const m = new Map<string, i32>();
  m.set(`k${n}`, n);
  return m;
};

export const main = (): i32 => {
  const out: Map<string, i32>[] = [new Map<string, i32>()];
  {
    using s = scope();
    s.spawn(table, 3, out, 0);
  }
  churn();
  return out[0].size;
};
