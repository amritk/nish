// R3, the use-after-free an expression-bodied helper opened: `grab` answers
// `g.value`, the caller keeps it past the lock and reads `c.s` outside it, a
// second lock stores a new string, and `churn()` reuses the old one's memory,
// so `old` would print what the allocator put there. The program is refused.
import { Mutex, MutexGuard } from "nish/threads";

const churn = (): i32 => {
  let t = 0;
  for (let i = 0; i < 4000; i++) {
    t = t + `zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz${i}`.length;
  }
  return t;
};

class Box {
  s: string = "first";
  xs: i32[];

  constructor() {
    this.xs = [0, 1];
  }
}

const grab = (g: MutexGuard<Box>): Box => g.value;

export const main = (): i32 => {
  const m = new Mutex<Box>(new Box());
  let c: Box = new Box();
  {
    using g = m.lock();
    c = grab(g);
  }
  const old = c.s;
  {
    using g = m.lock();
    g.value.s = "second";
  }
  churn();
  console.log(old);
  return 0;
};
