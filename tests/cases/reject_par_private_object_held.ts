// An object a function made itself writes nothing shared when a method writes
// it, until memory the caller reaches is inside it: `new Wrap(table)` keeps
// the captured `table`, so `w.clear()` writes the caller's array.
import { parallelFrom } from "nish/threads";

class Wrap {
  inner: i32[];

  constructor(inner: i32[]) {
    this.inner = inner;
  }

  clear(): void {
    this.inner[0] = 0;
  }
}

const viaCtor = (table: i32[], i: i32): i32 => {
  const w = new Wrap(table);
  w.clear();
  return i;
};

export const main = (): i32 => {
  const table: i32[] = [1, 2];
  const a = parallelFrom(2, (i) => viaCtor(table, i));
  return a[1];
};
