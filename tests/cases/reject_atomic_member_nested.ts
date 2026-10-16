// R1 holds at any depth: `h.a.b.value`.
import { AtomicI32 } from "nish/threads";
class Inner {
  b: AtomicI32;
  constructor() {
    this.b = new AtomicI32(0);
  }
}
class Outer {
  a: Inner;
  constructor() {
    this.a = new Inner();
  }
}
export const main = (): i32 => {
  const h = new Outer();
  h.a.b.add(1);
  return h.a.b.value;
};
