// WP29 P3: a guard's lock is given back at every exit of its block — its end,
// a `continue`, a `break`, a `return` after its value is computed, and inside
// an arena block, before the arena's release. Each function locks the same
// `Mutex` again after the exit it takes, so an exit that kept the lock would
// wait on itself and never print. Three tasks take the first two exits at
// once on one `Mutex` (a task opens no arena block, docs/LANGUAGE.md).
import { Mutex, scope } from "nish/threads";

class Tally {
  n: i32 = 0;
}

/** The first running total past `limit`: the `return` reads through the guard, then releases. */
const firstOver = (m: Mutex<Tally>, limit: i32): i32 => {
  for (let i: i32 = 0; i < 100; i++) {
    using g = m.lock();
    g.value.n = g.value.n + i;
    if (g.value.n > limit) {
      return g.value.n;
    }
  }
  return -1;
};

/** Counts the even `i` up to 6: a `continue` and a `break` each leave the guard's block. */
const evensToSix = (m: Mutex<Tally>): i32 => {
  for (let i: i32 = 0; i < 100; i++) {
    using g = m.lock();
    if (i % 2 === 1) {
      continue;
    }
    g.value.n = g.value.n + 1;
    if (i === 6) {
      break;
    }
  }
  using g = m.lock();
  return g.value.n;
};

/** A guard inside an arena block: the lock is given back before the arena releases. */
const labelled = (m: Mutex<Tally>): i32 => {
  {
    using a = arena();
    using g = m.lock();
    const label = `n=${g.value.n}`;
    g.value.n = g.value.n + toI32(label.length);
  }
  using g = m.lock();
  return g.value.n;
};

/**
 * Each pass takes the lock 101 times through `firstOver`'s `return` and up to
 * 8 times through `evensToSix`'s `continue` and `break`, and 2,000 passes on
 * three threads keep those exits contending for one `Mutex`.
 */
const work = (m: Mutex<Tally>): i32 => {
  let last: i32 = 0;
  for (let pass: i32 = 0; pass < 2000; pass++) {
    last = firstOver(m, 1000000000) + evensToSix(m);
  }
  return last;
};

export const main = (): i32 => {
  const a = new Mutex<Tally>(new Tally());
  console.log(`${firstOver(a, 10)} ${firstOver(a, 10)}`);
  const b = new Mutex<Tally>(new Tally());
  console.log(`${evensToSix(b)} ${evensToSix(b)}`);
  const c = new Mutex<Tally>(new Tally());
  console.log(`${labelled(c)} ${labelled(c)}`);
  const shared = new Mutex<Tally>(new Tally());
  const out: i32[] = [0, 0, 0];
  {
    using s = scope();
    s.spawn(work, shared, out, 0);
    s.spawn(work, shared, out, 1);
    s.spawn(work, shared, out, 2);
  }
  using g = shared.lock();
  console.log(`${g.value.n}`);
  return 0;
};
