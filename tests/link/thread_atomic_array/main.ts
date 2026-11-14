// The atomic arrays in tasks: four scope tasks bin a stream of values into
// one shared `AtomicI32Array` of 16 counters and one `AtomicI64Array` of byte
// totals, with `add`, `sub`, `min`, `max` and a `compareExchange` loop on the
// elements. Every update commutes, so the totals are the same whatever order
// the tasks ran in: natively, on the pool's threads, and under Node, in spawn
// order. A lost add would show in the sums the parent prints after the join.
// After it, the parent calls each `AtomicI64Array` method the tasks do not.
import { AtomicI32Array, AtomicI64Array, scope } from "nish/threads";

class Bins {
  counts: AtomicI32Array;
  bytes: AtomicI64Array;
  low: AtomicI32Array;
  high: AtomicI32Array;

  constructor() {
    this.counts = new AtomicI32Array(16);
    this.bytes = new AtomicI64Array(16);
    this.low = new AtomicI32Array(16);
    this.high = new AtomicI32Array(16);
    for (let b: i32 = 0; b < this.low.length; b++) {
      this.low.store(b, 1000000);
    }
  }
}

class Shard {
  seed: i32;
  n: i32;
  bins: Bins;

  constructor(seed: i32, n: i32, bins: Bins) {
    this.seed = seed;
    this.n = n;
    this.bins = bins;
  }
}

/** Raises element `b` of `a` to at least `v` with a `compareExchange` loop, as `max` does in one instruction. */
const raise = (a: AtomicI32Array, b: i32, v: i32): void => {
  let seen: i32 = a.load(b);
  while (seen < v) {
    const was: i32 = a.compareExchange(b, seen, v);
    if (was === seen) {
      return;
    }
    seen = was;
  }
};

const binShard = (s: Shard): i32 => {
  let v: i32 = s.seed;
  const block: i64 = 3000000000;
  for (let i: i32 = 0; i < s.n; i++) {
    v = (v * 75 + 74) % 65537;
    const b: i32 = v % 16;
    s.bins.counts.add(b, 1);
    s.bins.bytes.add(b, block);
    const one: i64 = 1;
    s.bins.bytes.sub(b, one);
    s.bins.low.min(b, v);
    raise(s.bins.high, b, v);
  }
  return s.n;
};

export const main = (): i32 => {
  const bins = new Bins();
  const done: i32[] = [0, 0, 0, 0];
  {
    using s = scope();
    s.spawn(binShard, new Shard(1, 25000, bins), done, 0);
    s.spawn(binShard, new Shard(2, 25000, bins), done, 1);
    s.spawn(binShard, new Shard(3, 25000, bins), done, 2);
    s.spawn(binShard, new Shard(4, 25000, bins), done, 3);
  }
  let total: i32 = 0;
  let bytes: i64 = 0;
  let low: i32 = 1000000;
  let high: i32 = 0;
  for (let b: i32 = 0; b < bins.counts.length; b++) {
    total = total + bins.counts.load(b);
    bytes = bytes + bins.bytes.load(b);
    low = bins.low.load(b) < low ? bins.low.load(b) : low;
    high = bins.high.max(b, 0) > high ? bins.high.load(b) : high;
  }
  console.log(`${done[0] + done[1] + done[2] + done[3]} ${total} ${bytes} ${low} ${high}`);
  const was: i32 = bins.counts.exchange(0, 7);
  const seen: i32 = bins.counts.compareExchange(0, 7, 9);
  console.log(`${was === bins.counts.load(0) ? 1 : 0} ${seen} ${bins.counts.load(0)} ${bins.counts.length}`);
  const big: i64 = 5000000000;
  const small: i64 = -7;
  bins.bytes.store(1, big);
  const before: i64 = bins.bytes.min(1, small);
  const lowest: i64 = bins.bytes.max(1, big);
  const swapped: i64 = bins.bytes.exchange(1, small);
  const kept: i64 = bins.bytes.compareExchange(1, small, big);
  const missed: i64 = bins.bytes.compareExchange(1, small, small);
  console.log(`${before} ${lowest} ${swapped} ${kept} ${missed} ${bins.bytes.load(1)} ${bins.bytes.length}`);
  return 0;
};
