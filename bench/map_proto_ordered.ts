// WP32 layout prototype 1 of 4: insertion-ordered, the shape of today's
// StringMap in self/map.ts (docs/wp32-map.md §2). The bucket table holds entry
// indices plus one and nothing else, so every occupied bucket a probe passes
// costs a load from the entry list and a full key compare, and growth hashes
// every key again. It is the baseline the fingerprinted layouts are measured
// against. StringMap has no `delete`; this one adds it with a tombstone bucket
// and a dead-entry flag, compacting on the same trigger as the other ordered
// layouts.
//
// The four `map_proto_*` programs run the same five workloads over the same
// keys and print the same checksums as each other and as bench/map_node.mjs,
// which runs them on Node's `Map`. `bench/run.mjs --only maps` builds them,
// compares the checksums and times each workload; pass `time` as the first
// argument to have a program print its own per-workload times to stderr.

const EMPTY: i32 = 0;
const TOMB: i32 = -1;
/** The first bucket count; `mask` starts at one less. */
const INITIAL_SLOTS: i32 = 8;

/** FNV-1a over the bytes, never 0, as in the other three layouts so that every one probes the same buckets. */
const hashStr = (key: string): u32 => {
  let h: u32 = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h = (h ^ toU32(key.charCodeAt(i))) * 16777619;
  }
  return h === 0 ? 1 : h;
};

/** murmur3's finaliser, never 0 for the same reason. */
const hashInt = (key: i32): u32 => {
  let h: u32 = toU32(key);
  h = (h ^ (h >>> 16)) * 2246822507;
  h = (h ^ (h >>> 13)) * 3266489909;
  h = h ^ (h >>> 16);
  return h === 0 ? 1 : h;
};

/** The first bucket for `h`: the low bits, folded with the high half as StringMap does. */
const home = (h: u32, mask: i32): i32 => toI32(h ^ (h >>> 16)) & mask;

class StrMap {
  /** Bucket -> entry index plus one; 0 is empty and -1 a deleted entry's bucket. */
  slots: i32[];
  mask: i32 = 7;
  keys: string[];
  values: i32[];
  /** Whether each entry is still in the map; the slot table holds no hash to mark it with. */
  alive: boolean[];
  live: i32 = 0;
  /** The bucket of the entry the last successful probe found. */
  found: i32 = 0;

  constructor() {
    this.slots = new Array<i32>(INITIAL_SLOTS);
    this.keys = [];
    this.values = [];
    this.alive = [];
  }

  /**
   * The entry index of `key`, or `-1 - bucket` for the empty bucket it would
   * take. Every occupied bucket on the way costs a load from `keys` and a key
   * compare, which is what the fingerprinted layouts exist to avoid.
   */
  probe(key: string): i32 {
    const n = toI32(this.slots.length);
    let b = home(hashStr(key), this.mask);
    while (b >= 0 && b < n) {
      const s = this.slots[b];
      if (s === EMPTY) {
        return -1 - b;
      }
      const at = s - 1;
      if (at >= 0 && at < toI32(this.keys.length) && this.keys[at] === key) {
        this.found = b;
        return at;
      }
      b = (b + 1) & this.mask;
    }
    panic("probe: bucket out of range");
  }

  get(key: string, missing: i32): i32 {
    const at = this.probe(key);
    return at >= 0 && at < toI32(this.values.length) ? this.values[at] : missing;
  }

  /** Add `delta` to `key`'s value, inserting it at `delta`: one probe either way. */
  add(key: string, delta: i32): void {
    const at = this.probe(key);
    if (at >= 0) {
      if (at < toI32(this.values.length)) {
        this.values[at] = this.values[at] + delta;
      }
      return;
    }
    this.insertAt(-1 - at, key, delta);
  }

  set(key: string, value: i32): void {
    const at = this.probe(key);
    if (at >= 0) {
      if (at < toI32(this.values.length)) {
        this.values[at] = value;
      }
      return;
    }
    this.insertAt(-1 - at, key, value);
  }

  /** Append an entry and point the empty bucket `b`, which a probe found, at it. */
  insertAt(b: i32, key: string, value: i32): void {
    this.keys.push(key);
    this.values.push(value);
    this.alive.push(true);
    this.live = this.live + 1;
    const used = toI32(this.keys.length);
    if (b >= 0 && b < toI32(this.slots.length)) {
      this.slots[b] = used;
    }
    // A bucket is taken by every entry, live or dead, until a rebuild.
    if (used * 4 > toI32(this.slots.length) * 3) {
      this.rebuild();
    }
  }

  delete(key: string): boolean {
    const at = this.probe(key);
    if (at < 0 || at >= toI32(this.alive.length)) {
      return false;
    }
    if (this.found >= 0 && this.found < toI32(this.slots.length)) {
      this.slots[this.found] = TOMB;
    }
    this.alive[at] = false;
    this.live = this.live - 1;
    return true;
  }

  /**
   * Compact when more than half the entries are dead, otherwise double; either
   * way the live entries keep their order, and every one is hashed again to
   * find its new bucket.
   */
  rebuild(): void {
    const used = toI32(this.keys.length);
    const size = this.live * 2 >= used ? toI32(this.slots.length) * 2 : toI32(this.slots.length);
    let to = 0;
    for (let from = 0; from < used; from++) {
      if (from < toI32(this.alive.length) && this.alive[from] && from < toI32(this.values.length)) {
        this.keys[to] = this.keys[from];
        this.values[to] = this.values[from];
        this.alive[to] = true;
        to++;
      }
    }
    while (toI32(this.keys.length) > to) {
      this.keys.pop();
      this.values.pop();
      this.alive.pop();
    }
    if (size === toI32(this.slots.length)) {
      // Compacting at the same size clears the table in place: a new one
      // would leave the old in the arena until the program's scope ends,
      // once per compaction, which a map that churns forever cannot afford.
      const slots = this.slots;
      for (let i = 0; i < toI32(slots.length); i++) {
        slots[i] = 0;
      }
    } else {
      this.slots = new Array<i32>(size);
    }
    this.mask = size - 1;
    for (let i = 0; i < to; i++) {
      let b = home(hashStr(this.keys[i]), this.mask);
      while (b >= 0 && b < size && this.slots[b] !== EMPTY) {
        b = (b + 1) & this.mask;
      }
      if (b >= 0 && b < size) {
        this.slots[b] = i + 1;
      }
    }
  }

  /** Sum of the live values, walked in insertion order. */
  sum(): u32 {
    let total: u32 = 0;
    for (let i = 0; i < toI32(this.alive.length); i++) {
      if (this.alive[i] && i < toI32(this.values.length)) {
        total = total + toU32(this.values[i]);
      }
    }
    return total;
  }
}

class IntMap {
  /** Bucket -> entry index plus one; 0 is empty and -1 a deleted entry's bucket. */
  slots: i32[];
  mask: i32 = 7;
  keys: i32[];
  values: i32[];
  /** Whether each entry is still in the map; the slot table holds no hash to mark it with. */
  alive: boolean[];
  live: i32 = 0;
  /** The bucket of the entry the last successful probe found. */
  found: i32 = 0;

  constructor() {
    this.slots = new Array<i32>(INITIAL_SLOTS);
    this.keys = [];
    this.values = [];
    this.alive = [];
  }

  /**
   * The entry index of `key`, or `-1 - bucket` for the empty bucket it would
   * take. Every occupied bucket on the way costs a load from `keys` and a key
   * compare, which is what the fingerprinted layouts exist to avoid.
   */
  probe(key: i32): i32 {
    const n = toI32(this.slots.length);
    let b = home(hashInt(key), this.mask);
    while (b >= 0 && b < n) {
      const s = this.slots[b];
      if (s === EMPTY) {
        return -1 - b;
      }
      const at = s - 1;
      if (at >= 0 && at < toI32(this.keys.length) && this.keys[at] === key) {
        this.found = b;
        return at;
      }
      b = (b + 1) & this.mask;
    }
    panic("probe: bucket out of range");
  }

  get(key: i32, missing: i32): i32 {
    const at = this.probe(key);
    return at >= 0 && at < toI32(this.values.length) ? this.values[at] : missing;
  }

  /** Add `delta` to `key`'s value, inserting it at `delta`: one probe either way. */
  add(key: i32, delta: i32): void {
    const at = this.probe(key);
    if (at >= 0) {
      if (at < toI32(this.values.length)) {
        this.values[at] = this.values[at] + delta;
      }
      return;
    }
    this.insertAt(-1 - at, key, delta);
  }

  set(key: i32, value: i32): void {
    const at = this.probe(key);
    if (at >= 0) {
      if (at < toI32(this.values.length)) {
        this.values[at] = value;
      }
      return;
    }
    this.insertAt(-1 - at, key, value);
  }

  /** Append an entry and point the empty bucket `b`, which a probe found, at it. */
  insertAt(b: i32, key: i32, value: i32): void {
    this.keys.push(key);
    this.values.push(value);
    this.alive.push(true);
    this.live = this.live + 1;
    const used = toI32(this.keys.length);
    if (b >= 0 && b < toI32(this.slots.length)) {
      this.slots[b] = used;
    }
    // A bucket is taken by every entry, live or dead, until a rebuild.
    if (used * 4 > toI32(this.slots.length) * 3) {
      this.rebuild();
    }
  }

  delete(key: i32): boolean {
    const at = this.probe(key);
    if (at < 0 || at >= toI32(this.alive.length)) {
      return false;
    }
    if (this.found >= 0 && this.found < toI32(this.slots.length)) {
      this.slots[this.found] = TOMB;
    }
    this.alive[at] = false;
    this.live = this.live - 1;
    return true;
  }

  /**
   * Compact when more than half the entries are dead, otherwise double; either
   * way the live entries keep their order, and every one is hashed again to
   * find its new bucket.
   */
  rebuild(): void {
    const used = toI32(this.keys.length);
    const size = this.live * 2 >= used ? toI32(this.slots.length) * 2 : toI32(this.slots.length);
    let to = 0;
    for (let from = 0; from < used; from++) {
      if (from < toI32(this.alive.length) && this.alive[from] && from < toI32(this.values.length)) {
        this.keys[to] = this.keys[from];
        this.values[to] = this.values[from];
        this.alive[to] = true;
        to++;
      }
    }
    while (toI32(this.keys.length) > to) {
      this.keys.pop();
      this.values.pop();
      this.alive.pop();
    }
    if (size === toI32(this.slots.length)) {
      // Compacting at the same size clears the table in place: a new one
      // would leave the old in the arena until the program's scope ends,
      // once per compaction, which a map that churns forever cannot afford.
      const slots = this.slots;
      for (let i = 0; i < toI32(slots.length); i++) {
        slots[i] = 0;
      }
    } else {
      this.slots = new Array<i32>(size);
    }
    this.mask = size - 1;
    for (let i = 0; i < to; i++) {
      let b = home(hashInt(this.keys[i]), this.mask);
      while (b >= 0 && b < size && this.slots[b] !== EMPTY) {
        b = (b + 1) & this.mask;
      }
      if (b >= 0 && b < size) {
        this.slots[b] = i + 1;
      }
    }
  }

  /** Sum of the live values, walked in insertion order. */
  sum(): u32 {
    let total: u32 = 0;
    for (let i = 0; i < toI32(this.alive.length); i++) {
      if (this.alive[i] && i < toI32(this.values.length)) {
        total = total + toU32(this.values[i]);
      }
    }
    return total;
  }
}

// ---- The workloads, identical in all four prototypes and in bench/map_node.mjs ----

/** A 32-bit LCG (Numerical Recipes); the top 24 bits are the draw. */
class Rng {
  state: u32 = 12345;

  next(): i32 {
    this.state = this.state * 1664525 + 1013904223;
    return toI32(this.state >>> 8);
  }
}

/**
 * `2n` distinct keys: the first `n` are inserted, the rest are the misses and
 * the churn workload's second half. An odd multiplier is a bijection mod 2^32,
 * so the integers are distinct, and so are their decimal spellings.
 */
const intKeys = (n: i32): i32[] => {
  const keys: i32[] = [];
  for (let i = 0; i < 2 * n; i++) {
    keys.push(toI32(toU32(i) * 2654435761));
  }
  return keys;
};

const strKeys = (ints: i32[]): string[] => {
  const keys: string[] = [];
  for (const k of ints) {
    keys.push(`k${k}`);
  }
  return keys;
};

/** The clock, read only when timing, so that an untimed run's instruction count does not depend on the vDSO. */
const clock = (timing: boolean): i64 => (timing ? monotonicNanos() : 0);

const report = (timing: boolean, name: string, started: i64, checksum: string): void => {
  console.log(`${name} ${checksum}`);
  if (timing) {
    writeError(`time ${name} ${monotonicNanos() - started}\n`);
  }
};

/** A fresh table holding the first `n` keys, each mapped to its index. */
const fillStrMap = (keys: string[], n: i32): StrMap => {
  const m = new StrMap();
  for (let i = 0; i < n && i < toI32(keys.length); i++) {
    m.set(keys[i], i);
  }
  return m;
};

const fillIntMap = (keys: i32[], n: i32): IntMap => {
  const m = new IntMap();
  for (let i = 0; i < n && i < toI32(keys.length); i++) {
    m.set(keys[i], i);
  }
  return m;
};

const runStr = (keys: string[], n: i32, timing: boolean): void => {
  const mask = n - 1;
  const rng = new Rng();
  let t = clock(timing);
  let built = 0;
  for (let round = 0; round < 3; round++) {
    built = built + fillStrMap(keys, n).live;
  }
  const m = fillStrMap(keys, n);
  report(timing, "insert str", t, `${built + m.live} ${m.sum()}`);

  t = clock(timing);
  let hits: u32 = 0;
  for (let j = 0; j < 8 * n; j++) {
    const at = rng.next() & mask;
    if (at >= 0 && at < toI32(keys.length)) {
      hits = hits + toU32(m.get(keys[at], -1));
    }
  }
  report(timing, "hit str", t, `${hits}`);

  t = clock(timing);
  let misses: u32 = 0;
  for (let j = 0; j < 8 * n; j++) {
    const at = n + (rng.next() & mask);
    if (at >= 0 && at < toI32(keys.length)) {
      misses = misses + toU32(m.get(keys[at], j & 7));
    }
  }
  report(timing, "miss str", t, `${misses}`);

  t = clock(timing);
  const vocab = n / 4;
  const counts = new StrMap();
  for (let j = 0; j < 8 * n; j++) {
    const at = rng.next() & rng.next() & (vocab - 1);
    if (at >= 0 && at < toI32(keys.length)) {
      counts.add(keys[at], 1);
    }
  }
  let weighted: u32 = 0;
  for (let i = 0; i < vocab && i < toI32(keys.length); i++) {
    weighted = weighted + toU32(counts.get(keys[i], 0)) * toU32(i);
  }
  report(timing, "count str", t, `${counts.live} ${weighted}`);

  t = clock(timing);
  const window = n / 2;
  const pool = 2 * n - 1;
  const churn = new StrMap();
  for (let i = 0; i < 8 * n; i++) {
    const add = i & pool;
    if (add >= 0 && add < toI32(keys.length)) {
      churn.set(keys[add], i);
    }
    const drop = (i - window) & pool;
    if (i >= window && drop >= 0 && drop < toI32(keys.length)) {
      churn.delete(keys[drop]);
    }
  }
  report(timing, "churn str", t, `${churn.live} ${churn.sum()}`);
};

const runInt = (keys: i32[], n: i32, timing: boolean): void => {
  const mask = n - 1;
  const rng = new Rng();
  let t = clock(timing);
  let built = 0;
  for (let round = 0; round < 3; round++) {
    built = built + fillIntMap(keys, n).live;
  }
  const m = fillIntMap(keys, n);
  report(timing, "insert int", t, `${built + m.live} ${m.sum()}`);

  t = clock(timing);
  let hits: u32 = 0;
  for (let j = 0; j < 8 * n; j++) {
    const at = rng.next() & mask;
    if (at >= 0 && at < toI32(keys.length)) {
      hits = hits + toU32(m.get(keys[at], -1));
    }
  }
  report(timing, "hit int", t, `${hits}`);

  t = clock(timing);
  let misses: u32 = 0;
  for (let j = 0; j < 8 * n; j++) {
    const at = n + (rng.next() & mask);
    if (at >= 0 && at < toI32(keys.length)) {
      misses = misses + toU32(m.get(keys[at], j & 7));
    }
  }
  report(timing, "miss int", t, `${misses}`);

  t = clock(timing);
  const vocab = n / 4;
  const counts = new IntMap();
  for (let j = 0; j < 8 * n; j++) {
    const at = rng.next() & rng.next() & (vocab - 1);
    if (at >= 0 && at < toI32(keys.length)) {
      counts.add(keys[at], 1);
    }
  }
  let weighted: u32 = 0;
  for (let i = 0; i < vocab && i < toI32(keys.length); i++) {
    weighted = weighted + toU32(counts.get(keys[i], 0)) * toU32(i);
  }
  report(timing, "count int", t, `${counts.live} ${weighted}`);

  t = clock(timing);
  const window = n / 2;
  const pool = 2 * n - 1;
  const churn = new IntMap();
  for (let i = 0; i < 8 * n; i++) {
    const add = i & pool;
    if (add >= 0 && add < toI32(keys.length)) {
      churn.set(keys[add], i);
    }
    const drop = (i - window) & pool;
    if (i >= window && drop >= 0 && drop < toI32(keys.length)) {
      churn.delete(keys[drop]);
    }
  }
  report(timing, "churn int", t, `${churn.live} ${churn.sum()}`);
};

export const main = (): i32 => {
  // The key count; a power of two, because the workloads draw an index by masking.
  const n: i32 = 65536; // bench:n
  const timing = process.argv.length > 1 && process.argv[1] === "time";
  const ints = intKeys(n);
  runStr(strKeys(ints), n, timing);
  runInt(ints, n, timing);
  return 0;
};
