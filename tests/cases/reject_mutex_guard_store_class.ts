// R4: a guard stores a scalar or a `string`, which it copies, but not an
// object: a task's `new` is in its arena, freed when the task is joined, so
// the `Mutex`'s data would point into memory `churn()` reuses.
import { Mutex, scope } from "nish/threads";

const churn = (): i32 => {
  let t = 0;
  for (let i = 0; i < 4000; i++) {
    t = t + `zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz${i}`.length;
  }
  return t;
};

class Cell {
  n: i32 = 0;
}

class Holder {
  cell: Cell;

  constructor() {
    this.cell = new Cell();
  }
}

const put = (m: Mutex<Holder>): i32 => {
  using g = m.lock();
  g.value.cell = new Cell();
  return 0;
};

export const main = (): i32 => {
  const m = new Mutex<Holder>(new Holder());
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(put, m, out, 0);
  }
  churn();
  using g = m.lock();
  return g.value.cell.n;
};
