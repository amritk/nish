// WP40 H1.2, Q12(a): each declarator of a `using` opens before the next one's
// initialiser runs, so an `orReturn()` in a later initialiser leaves with the
// earlier declarators open, and they are released on that edge. `lockFirst`
// holds the lock when the file's path fails; the function locks the same
// `Mutex` again afterwards, so a path that kept the lock would wait on itself
// and never print. `arenaFirst` leaves with the arena open: the `Err` is a
// number packed into the register `Result` (a string would be refused, NL2423,
// `reject_using_arena_declarator_or_return`), and the arena is as high after
// both calls as before them, with other allocations made in between. `scopeFirst`
// leaves with a scope open and joins it. `three` opens an arena, a lock and a
// file and leaves at the third; then it locks again.
// Native only: under Node `orReturn` throws (docs/RUN_UNDER_NODE.md).
import { Mutex, scope } from "nish/threads";

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

const pathFor = (fail: i32): Result<string, i32> => (fail === 0 ? Ok("/dev/null") : Err(fail));

const fill = (k: i32): i32[] => {
  const xs: i32[] = [];
  for (let i = 0; i < k; i++) {
    xs.push(i);
  }
  return xs;
};

const churn = (): i32 => {
  let t = 0;
  for (let i = 0; i < 64; i++) {
    t = t + `${i * 31}-${fill(i).length}`.length;
  }
  return t;
};

const lockFirst = (m: Mutex<Tally>, fail: i32): Result<i32, i32> => {
  using g = m.lock(), f = new File(pathFor(fail).orReturn());
  g.value.n = g.value.n + 1;
  return Ok(g.value.n * 10 + f.read());
};

const arenaFirst = (k: i32, fail: i32): Result<i32, i32> => {
  using a = arena(), f = new File(pathFor(fail).orReturn());
  const xs = fill(k);
  return Ok(xs.length + f.read());
};

const scopeFirst = (fail: i32): Result<i32, i32> => {
  using s = scope(), f = new File(pathFor(fail).orReturn());
  return Ok(f.read());
};

const three = (m: Mutex<Tally>, fail: i32): Result<i32, i32> => {
  using a = arena(), g = m.lock(), f = new File(pathFor(fail).orReturn());
  const xs = fill(50);
  g.value.n = g.value.n + xs.length;
  return Ok(g.value.n + f.read());
};

const relock = (m: Mutex<Tally>): i32 => {
  using g = m.lock();
  return g.value.n;
};

export const main = (): i32 => {
  const m = new Mutex<Tally>(new Tally());
  const l1 = lockFirst(m, 4).unwrapOr(-100);
  const l2 = lockFirst(m, 0).unwrapOr(-100);
  console.log(`lockFirst ${l1} ${l2} ${relock(m)}`);
  const before = Arena.used();
  const a1 = arenaFirst(1000, 5).unwrapOr(-100);
  const c = churn();
  const a2 = arenaFirst(1000, 0).unwrapOr(-100);
  const after = Arena.used();
  console.log(`arenaFirst ${a1} ${a2} ${c > 0} ${after === before ? "released" : "kept"}`);
  console.log(`scopeFirst ${scopeFirst(6).unwrapOr(-100)} ${scopeFirst(0).unwrapOr(-100)}`);
  const t1 = three(m, 7).unwrapOr(-100);
  const t2 = three(m, 0).unwrapOr(-100);
  console.log(`three ${t1} ${t2} ${relock(m)}`);
  return 0;
};
