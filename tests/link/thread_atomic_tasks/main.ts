// The atomics in tasks: a named task, an arrow task and a task with no
// destination update one `AtomicI32` and one `AtomicI64` a shard at a time,
// with `add`, `sub`, `min`, `max` and a `compareExchange` loop that raises a
// high-water mark. Every update commutes, so the totals are the same whatever
// order the tasks ran in: natively, on the pool's threads, and under Node, in
// spawn order. The order-dependent answers — what `exchange`, `store` and a
// single `compareExchange` saw — are read by the parent after the join.
import { AtomicI32, AtomicI64, scope } from "nish/threads";

class Counters {
  hits: AtomicI32;
  bytes: AtomicI64;
  low: AtomicI32;
  high: AtomicI32;
  block: i64 = 3000000000;

  constructor() {
    this.hits = new AtomicI32(0);
    this.bytes = new AtomicI64(0);
    this.low = new AtomicI32(1000000);
    this.high = new AtomicI32(0);
  }
}

class Shard {
  seed: i32;
  n: i32;
  c: Counters;

  constructor(seed: i32, n: i32, c: Counters) {
    this.seed = seed;
    this.n = n;
    this.c = c;
  }
}

/** Raises `a` to at least `v` with a `compareExchange` loop, as `max` does in one instruction. */
const raise = (a: AtomicI32, v: i32): void => {
  let seen: i32 = a.load();
  while (seen < v) {
    const was: i32 = a.compareExchange(seen, v);
    if (was === seen) {
      return;
    }
    seen = was;
  }
};

const count = (s: Shard): i32 => {
  let v: i32 = s.seed;
  for (let i: i32 = 0; i < s.n; i++) {
    v = (v * 75 + 74) % 65537;
    s.c.hits.add(1);
    s.c.bytes.add(s.c.block);
    s.c.low.min(v);
    raise(s.c.high, v);
  }
  return s.n;
};

const undo = (s: Shard): void => {
  for (let i: i32 = 0; i < s.n; i++) {
    s.c.hits.sub(1);
    const one: i64 = 1;
    s.c.bytes.sub(one);
  }
};

export const main = (): i32 => {
  const c = new Counters();
  const done: i32[] = [0, 0, 0];
  const extra = new AtomicI32(0);
  {
    using s = scope();
    s.spawn(count, new Shard(1, 20000, c), done, 0);
    s.spawn(count, new Shard(2, 20000, c), done, 1);
    s.spawn((n: i32): i32 => {
      for (let i: i32 = 0; i < n; i++) {
        extra.add(i);
        extra.max(0);
      }
      return n;
    }, 300, done, 2);
    s.spawn(undo, new Shard(3, 500, c));
  }
  console.log(`${c.hits.load()} ${c.bytes.load()} ${c.low.load()} ${c.high.load()}`);
  console.log(`${extra.load()} ${done[0] + done[1] + done[2]}`);
  const was: i32 = c.hits.exchange(7);
  const failed: i32 = c.hits.compareExchange(8, 1);
  const swapped: i32 = c.hits.compareExchange(7, 2);
  c.low.store(-5);
  console.log(`${was} ${failed} ${swapped} ${c.hits.load()} ${c.low.load()}`);
  return 0;
};
