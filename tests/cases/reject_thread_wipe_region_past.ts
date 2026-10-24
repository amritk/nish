// A task that hands a helper shared memory may not write below it: `g`
// passes the inner record of what it is handed on to `h`, which writes it,
// so the task writes memory its caller can see two calls down.
import { scope } from "nish/threads";
class Inner {
  x: i32 = 0;
}
class Outer {
  readonly inner: Inner;
  constructor() {
    this.inner = new Inner();
  }
}
const h = (p: Inner): void => {
  p.x = 1;
};
const g = (a: Outer): void => {
  h(a.inner);
};
const clear = (a: Outer): i32 => {
  g(a);
  return 0;
};
export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(clear, new Outer(), out, 0);
  }
  return out[0];
};
