// R3, an expression-bodied helper hands `g.value` to a call and answers what it gives back: the argument is judged as `return g.value` is, by the type it would carry out.
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

const keep = (b: Box): Box => b;
const grab = (g: MutexGuard<Box>): Box => keep(g.value);

export const main = (): i32 => {
  const m = new Mutex<Box>(new Box());
  {
    using g = m.lock();
    const c = grab(g);
    console.log(c.s);
  }
  return 0;
};
