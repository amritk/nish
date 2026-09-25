// A parallel body's allocations are released after every element, so each has
// to die before the body returns. `width` stores its string into a `Box`, and
// the escape analysis stops following a value once it is stored, so it cannot
// prove the string dead; `Row` holds a string, so nothing else proves it
// either. Refused, naming the allocation that escapes.
import { parallelMapInto } from "nish/threads";

class Row {
  id: i32 = 0;
  name: string = "";
}

class Box {
  s: string = "";
  constructor(s: string) {
    this.s = s;
  }
}

const width = (r: Row): i32 => {
  const b = new Box(`${r.id}`);
  return b.s.length;
};

export const main = (): i32 => {
  const rows: Row[] = [new Row()];
  const out: i32[] = [0];
  parallelMapInto(rows, out, width);
  return out[0];
};
