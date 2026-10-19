// NL2348: the same rule for an arrow body of `parallelMap` answering an object.
import { parallelMap } from "nish/threads";

class Cell {
  v: i32 = 0;
}

export const main = (): i32 => {
  const src: i32[] = [1, 2, 3];
  const cells = parallelMap(src, (x: i32): Cell => {
    const c = new Cell();
    c.v = x;
    return c;
  });
  return cells[0].v;
};
