// A body that only reads can still race: an element of `src` holds an `f64[]`,
// which could be the `dst` another thread is writing while this one reads it.
import { parallelMapInto } from "nish/threads";

class Row {
  cells: f64[];
  weight: f64 = 1.0;
  constructor(cells: f64[]) {
    this.cells = cells;
  }
}

export const main = (): i32 => {
  const out: f64[] = [0.0];
  const rows: Row[] = [new Row(out)];
  parallelMapInto(rows, out, (r) => r.weight);
  return 0;
};
