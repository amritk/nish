// R3, an expression-bodied helper answers `new Wrap(g.value)`, the guarded object held by a fresh one: the argument is judged as `return g.value` is.
import { Mutex, MutexGuard } from "nish/threads";

class Box {
  s: string = "first";
  xs: i32[];

  constructor() {
    this.xs = [0, 1];
  }
}

class Wrap {
  b: Box;

  constructor(b: Box) {
    this.b = b;
  }
}

const grab = (g: MutexGuard<Box>): Wrap => new Wrap(g.value);

export const main = (): i32 => {
  const m = new Mutex<Box>(new Box());
  {
    using g = m.lock();
    const c = grab(g);
    console.log(c.b.s);
  }
  return 0;
};
