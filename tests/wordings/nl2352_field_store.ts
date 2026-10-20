// NL2352: a string a parallel body builds and stores into a field of an
// element is refused, with the serial loop that does the store on the calling thread.
import { parallelMap } from "nish/threads";

class Row {
  n: i32;
  label: string;

  constructor(n: i32) {
    this.n = n;
    this.label = "";
  }
}

export const main = (): i32 => {
  const rows: Row[] = [new Row(1), new Row(2)];
  const ys = parallelMap(rows, (r: Row): i32 => {
    r.label = `row ${r.n}`;
    return r.n;
  });
  console.log(ys.length);
  console.log(rows[1].label);
  return 0;
};
