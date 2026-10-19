// NL2348: `parallelFrom` copies a number, a string or an array of numbers out
// of a worker's arena, and an object is none of them.
import { parallelFrom } from "nish/threads";

class Cell {
  v: i32 = 0;
}

const cellAt = (i: i32): Cell => {
  const c = new Cell();
  c.v = i;
  return c;
};

export const main = (): i32 => {
  const cells = parallelFrom(3, cellAt);
  return cells[2].v;
};
