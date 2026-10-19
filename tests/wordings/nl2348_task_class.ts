// NL2348: a task's answer crosses back by copy too, so an object is refused.
import { scope } from "nish/threads";

class Cell {
  v: i32 = 0;
}

const make = (v: i32): Cell => {
  const c = new Cell();
  c.v = v;
  return c;
};

export const main = (): i32 => {
  const cells: Cell[] = [new Cell()];
  {
    using s = scope();
    s.spawn(make, 7, cells, 0);
  }
  return cells[0].v;
};
