// A helper that writes through what its parameter holds writes past that
// parameter: handing it the body's own array of the element's arrays does not
// make its store private.
import { parallelMapInto } from "nish/threads";

class Cell {
  xs: f64[];

  constructor() {
    this.xs = [0.0];
  }
}

const zeroFirst = (rows: f64[][]): void => {
  rows[0][0] = 0.0;
};

const clear = (c: Cell): i32 => {
  const rows: f64[][] = [];
  rows.push(c.xs);
  zeroFirst(rows);
  return 0;
};

export const main = (): i32 => {
  const cs: Cell[] = [new Cell(), new Cell()];
  const out: i32[] = [0, 0];
  parallelMapInto(cs, out, clear);
  return out[0];
};
