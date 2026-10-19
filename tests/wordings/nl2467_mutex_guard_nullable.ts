// NL2467: a nullable field read through a guard is a pointer that would outlive the lock.
import { Mutex } from "nish/threads";

class Log {
  last: string | null = null;
  n: i32 = 0;
}

export const main = (): i32 => {
  const m = new Mutex<Log>(new Log());
  let n: i32 = 0;
  {
    using g = m.lock();
    const last = g.value.last;
    if (last !== null) {
      n = last.length;
    }
  }
  return n;
};
