// R3, an expression-bodied helper answers `(g.value)`: the parentheses do not hide the guarded object.
import { Mutex, MutexGuard } from "nish/threads";

class Box {
  s: string = "first";
  xs: i32[];

  constructor() {
    this.xs = [0, 1];
  }
}

const grab = (g: MutexGuard<Box>): Box => (g.value);

export const main = (): i32 => {
  const m = new Mutex<Box>(new Box());
  {
    using g = m.lock();
    const c = grab(g);
    console.log(c.s);
  }
  return 0;
};
