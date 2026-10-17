// An expression-bodied helper answers `m.lock()`: the guard is not the initialiser of a `using`, so nothing would release the lock, as in a block body.
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

const relock = (m: Mutex<Box>): MutexGuard<Box> => m.lock();

export const main = (): i32 => {
  const m = new Mutex<Box>(new Box());
  {
    using g = relock(m);
    console.log(g.value.s);
  }
  return 0;
};
