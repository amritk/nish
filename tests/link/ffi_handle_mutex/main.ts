// WP40 H1.2: a handle beside a mutex lock in one `using`. The block closes its
// declarators in the reverse of the order they opened, on an early `return` as
// on falling off its end: in `lock(), new File(...)` the file is closed while
// the lock is still held, and in `new File(...), lock()` the lock is given back
// before the file is closed. Each function locks the same `Mutex` again after
// its block, so a close that kept the lock would wait on itself and never print.
import { Mutex } from "nish/threads";

declare function fopen(path: string, mode: string): CPtr | null;
declare function fclose(p: CPtr): i32;
declare function fgetc(p: CPtr): i32;

class File {
  readonly file: CPtr | null;
  constructor(path: string) {
    this.file = fopen(path, "r");
  }
  read(): i32 {
    const p = this.file;
    if (p === null) {
      return -2;
    }
    return fgetc(p);
  }
  [Symbol.dispose](): void {
    const p = this.file;
    if (p !== null) {
      fclose(p);
    }
  }
}

class Tally {
  n: i32 = 0;
}

/** The lock then the file: an early `return` closes the file, then unlocks. */
const lockThenFile = (m: Mutex<Tally>, k: i32): i32 => {
  {
    using g = m.lock(), f = new File("/dev/null");
    g.value.n = g.value.n - f.read();
    if (k > 0) {
      return g.value.n;
    }
  }
  using g = m.lock();
  return g.value.n * 10;
};

/** The file then the lock: the lock is given back first, then the file closed. */
const fileThenLock = (m: Mutex<Tally>, k: i32): i32 => {
  {
    using f = new File("/dev/null"), g = m.lock();
    g.value.n = g.value.n - f.read();
    if (k > 0) {
      return g.value.n;
    }
  }
  using g = m.lock();
  return g.value.n * 10;
};

export const main = (): i32 => {
  const m = new Mutex<Tally>(new Tally());
  const a = lockThenFile(m, 1);
  const b = lockThenFile(m, 0);
  const c = fileThenLock(m, 1);
  const d = fileThenLock(m, 0);
  using g = m.lock();
  console.log(`${a} ${b} ${c} ${d} ${g.value.n}`);
  return 0;
};
