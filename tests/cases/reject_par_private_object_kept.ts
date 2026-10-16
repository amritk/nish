// The same object, given the caller's array by a method rather than by its
// constructor: once `w.hold(table)` has put it there, `w.clear()` writes it.
import { parallelFrom } from "nish/threads";

class Wrap {
  inner: i32[] | null = null;

  hold(xs: i32[]): void {
    this.inner = xs;
  }

  clear(): void {
    const xs = this.inner;
    if (xs !== null) {
      xs[0] = 0;
    }
  }
}

const viaMethod = (table: i32[], i: i32): i32 => {
  const w = new Wrap();
  w.hold(table);
  w.clear();
  return i;
};

export const main = (): i32 => {
  const table: i32[] = [1, 2];
  const a = parallelFrom(2, (i) => viaMethod(table, i));
  return a[1];
};
