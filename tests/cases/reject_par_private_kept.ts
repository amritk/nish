// A parallel body's own array handed to a function that writes what it is
// handed and keeps it in the element: the element is shared by the caller,
// so the body writes memory its caller can see.
import { parallelMapInto } from "nish/threads";

class Cell {
  xs: f64[];

  constructor() {
    this.xs = [];
  }
}

const attach = (c: Cell, xs: f64[]): void => {
  xs[0] = 1.0;
  c.xs = xs;
};

const fresh = (c: Cell): i32 => {
  const xs = new Array<f64>(4);
  attach(c, xs);
  return 0;
};

export const main = (): i32 => {
  const cs: Cell[] = [new Cell(), new Cell()];
  const out: i32[] = [0, 0];
  parallelMapInto(cs, out, fresh);
  return out[0];
};
