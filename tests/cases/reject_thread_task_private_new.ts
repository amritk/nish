// The `new` route: a constructor is a call, and one that keeps the array it
// is handed makes it shared as a function that keeps it would. `Box` keeps
// `xs`, so the task's store into it counts.
import { scope } from "nish/threads";

class Box {
  xs: i32[];

  constructor(xs: i32[]) {
    this.xs = xs;
  }
}

const boxed = (n: i32): i32 => {
  const xs = new Array<i32>(n);
  xs[0] = n;
  const b = new Box(xs);
  return b.xs[0];
};

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(boxed, 4, out, 0);
  }
  return out[0];
};
