// WP29 P3: a `using` with several declarators, where a lock shares the
// statement with a scope or an arena. Each block closes its declarators in the
// reverse of the order they opened: in `arena(), lock()` the lock is released
// before the arena, and in `lock(), arena()` the arena before the lock. Each
// function locks the same `Mutex` again after its block, so a close that kept
// the lock would wait on itself and never print. (`lock(), scope()` is refused
// by R5, `reject_mutex_using_lock_then_scope`.)
import { Mutex, scope } from "nish/threads";

class Tally {
  n: i32 = 0;
}

/** A scope opened before the lock: it files no task, and joins at the block's end like any other. */
const scopeThenLock = (m: Mutex<Tally>): i32 => {
  {
    using s = scope(), g = m.lock();
    g.value.n = g.value.n + 1;
  }
  using g = m.lock();
  return g.value.n;
};

/** An arena then a lock: what the block allocates is released after the lock is given back. */
const arenaThenLock = (m: Mutex<Tally>): i32 => {
  {
    using a = arena(), g = m.lock();
    const label = `n=${g.value.n}`;
    g.value.n = g.value.n + toI32(label.length);
  }
  using g = m.lock();
  return g.value.n;
};

/** A lock then an arena: the arena is released first, while the lock is still held. */
const lockThenArena = (m: Mutex<Tally>): i32 => {
  {
    using g = m.lock(), a = arena();
    const label = `n=${g.value.n}`;
    g.value.n = g.value.n + toI32(label.length) * 10;
  }
  using g = m.lock();
  return g.value.n;
};

export const main = (): i32 => {
  const m = new Mutex<Tally>(new Tally());
  console.log(`${scopeThenLock(m)} ${scopeThenLock(m)}`);
  console.log(`${arenaThenLock(m)} ${arenaThenLock(m)}`);
  console.log(`${lockThenArena(m)} ${lockThenArena(m)}`);
  return 0;
};
