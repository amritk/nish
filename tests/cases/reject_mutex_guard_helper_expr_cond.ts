// R3, an expression-bodied helper answers `cond ? g.value : d`: either arm may be its answer, so `g.value` in an arm is judged as `return g.value` is.
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

const grab = (g: MutexGuard<Box>, d: Box): Box => (g.value.xs.length > 1 ? g.value : d);

export const main = (): i32 => {
  const m = new Mutex<Box>(new Box());
  {
    using g = m.lock();
    const c = grab(g, new Box());
    console.log(c.s);
  }
  return 0;
};
