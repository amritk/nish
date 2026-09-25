// WP32 layout prototype 4 of 4: unordered, with the keys and values in the
// buckets themselves (docs/wp32-map.md §2). A hit is one bucket and no
// indirection, and a delete shifts the rest of its run back rather than
// leaving a tombstone, but iteration is bucket order, which is not what a
// JavaScript `Map` promises. It is the layout the ordered ones are measured
// against, not one the language will ship (§10). Each bucket keeps its key's
// full hash, compared before the key and reused by growth.
//
// The four `map_proto_*` programs run the same five workloads over the same
// keys and print the same checksums as each other and as bench/map_node.mjs,
// which runs them on Node's `Map`. `bench/run.mjs --only maps` builds them,
// compares the checksums and times each workload; pass `time` as the first
// argument to have a program print its own per-workload times to stderr.

/** The first bucket count; `mask` starts at one less. */
const INITIAL_SLOTS: i32 = 8;

/** FNV-1a over the bytes, never 0: a stored hash of 0 marks an empty bucket. */
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
  /** Each bucket's full hash; 0 is an empty bucket, which no key hashes to. */
  hashes: u32[];
  /** The key in each bucket. `string | null` because an array of strings cannot be zero-filled. */
  keys: (string | null)[];
  values: i32[];
  mask: i32 = 7;
  live: i32 = 0;

  constructor() {
    this.hashes = new Array<u32>(INITIAL_SLOTS);
    this.keys = new Array<string | null>(INITIAL_SLOTS);
    this.values = new Array<i32>(INITIAL_SLOTS);
  }

  /**
   * The bucket holding `key`, or `-1 - bucket` for the empty bucket it would
   * take. The stored hash is compared first, so a key compare is almost
   * always a match.
   */
  probe(key: string, h: u32): i32 {
    const n = toI32(this.hashes.length);
    let b = home(h, this.mask);
    while (b >= 0 && b < n) {
      const s = this.hashes[b];
      if (s === 0) {
        return -1 - b;
      }
      if (s === h && b < toI32(this.keys.length)) {
        const k = this.keys[b];
        if (k !== null && k === key) {
          return b;
        }
      }
      b = (b + 1) & this.mask;
    }
    panic("probe: bucket out of range");
  }

  get(key: string, missing: i32): i32 {
    const b = this.probe(key, hashStr(key));
    return b >= 0 && b < toI32(this.values.length) ? this.values[b] : missing;
  }

  /** Add `delta` to `key`'s value, inserting it at `delta`: one probe either way. */
  add(key: string, delta: i32): void {
    const h = hashStr(key);
    const b = this.probe(key, h);
    if (b >= 0) {
      if (b < toI32(this.values.length)) {
        this.values[b] = this.values[b] + delta;
      }
      return;
    }
    this.insertAt(-1 - b, key, h, delta);
  }

  set(key: string, value: i32): void {
    const h = hashStr(key);
    const b = this.probe(key, h);
    if (b >= 0) {
      if (b < toI32(this.values.length)) {
        this.values[b] = value;
      }
      return;
    }
    this.insertAt(-1 - b, key, h, value);
  }

  insertAt(b: i32, key: string, h: u32, value: i32): void {
    if (b >= 0 && b < toI32(this.hashes.length) && b < toI32(this.keys.length) && b < toI32(this.values.length)) {
      this.hashes[b] = h;
      this.keys[b] = key;
      this.values[b] = value;
    }
    this.live = this.live + 1;
    if (this.live * 4 > toI32(this.hashes.length) * 3) {
      this.grow();
    }
  }

  /**
   * Linear probing's backward-shift delete: each later entry of the run that
   * may sit in the emptied bucket moves into it, so there are no tombstones
   * and a probe never walks past a deleted key.
   */
  delete(key: string): boolean {
    let hole = this.probe(key, hashStr(key));
    if (hole < 0) {
      return false;
    }
    const n = toI32(this.hashes.length);
    let b = (hole + 1) & this.mask;
    while (b >= 0 && b < n && this.hashes[b] !== 0) {
      const want = home(this.hashes[b], this.mask);
      // The entry at `b` may move to `hole` when `hole` lies on its path, from `want` to `b`.
      if (((b - want) & this.mask) >= ((b - hole) & this.mask)) {
        if (hole >= 0 && hole < n && hole < toI32(this.keys.length) && hole < toI32(this.values.length) && b < toI32(this.keys.length) && b < toI32(this.values.length)) {
          this.hashes[hole] = this.hashes[b];
          this.keys[hole] = this.keys[b];
          this.values[hole] = this.values[b];
        }
        hole = b;
      }
      b = (b + 1) & this.mask;
    }
    if (hole >= 0 && hole < n && hole < toI32(this.keys.length)) {
      this.hashes[hole] = 0;
      this.keys[hole] = null;
    }
    this.live = this.live - 1;
    return true;
  }

  /** Double, re-filing every entry by its stored hash. */
  grow(): void {
    const oldHashes = this.hashes;
    const oldKeys = this.keys;
    const oldValues = this.values;
    const size = toI32(oldHashes.length) * 2;
    this.hashes = new Array<u32>(size);
    this.keys = new Array<string | null>(size);
    this.values = new Array<i32>(size);
    this.mask = size - 1;
    for (let i = 0; i < toI32(oldHashes.length); i++) {
      const h = oldHashes[i];
      if (h !== 0) {
        let b = home(h, this.mask);
        while (b >= 0 && b < size && this.hashes[b] !== 0) {
          b = (b + 1) & this.mask;
        }
        if (b >= 0 && b < size && i < toI32(oldKeys.length) && i < toI32(oldValues.length)) {
          this.hashes[b] = h;
          this.keys[b] = oldKeys[i];
          this.values[b] = oldValues[i];
        }
      }
    }
  }

  /** Sum of the live values, walked in bucket order. */
  sum(): u32 {
    let total: u32 = 0;
    for (let i = 0; i < toI32(this.hashes.length) && i < toI32(this.values.length); i++) {
      if (this.hashes[i] !== 0) {
        total = total + toU32(this.values[i]);
      }
    }
    return total;
  }
}

class IntMap {
  /** Each bucket's full hash; 0 is an empty bucket, which no key hashes to. */
  hashes: u32[];
  keys: i32[];
  values: i32[];
  mask: i32 = 7;
  live: i32 = 0;

  constructor() {
    this.hashes = new Array<u32>(INITIAL_SLOTS);
    this.keys = new Array<i32>(INITIAL_SLOTS);
    this.values = new Array<i32>(INITIAL_SLOTS);
  }

  /**
   * The bucket holding `key`, or `-1 - bucket` for the empty bucket it would
   * take. The stored hash is compared first, so a key compare is almost
   * always a match.
   */
  probe(key: i32, h: u32): i32 {
    const n = toI32(this.hashes.length);
    let b = home(h, this.mask);
    while (b >= 0 && b < n) {
      const s = this.hashes[b];
      if (s === 0) {
        return -1 - b;
      }
      if (s === h && b < toI32(this.keys.length)) {
        if (this.keys[b] === key) {
          return b;
        }
      }
      b = (b + 1) & this.mask;
    }
    panic("probe: bucket out of range");
  }

  get(key: i32, missing: i32): i32 {
    const b = this.probe(key, hashInt(key));
    return b >= 0 && b < toI32(this.values.length) ? this.values[b] : missing;
  }

  /** Add `delta` to `key`'s value, inserting it at `delta`: one probe either way. */
  add(key: i32, delta: i32): void {
    const h = hashInt(key);
    const b = this.probe(key, h);
    if (b >= 0) {
      if (b < toI32(this.values.length)) {
        this.values[b] = this.values[b] + delta;
      }
      return;
    }
    this.insertAt(-1 - b, key, h, delta);
  }

  set(key: i32, value: i32): void {
    const h = hashInt(key);
    const b = this.probe(key, h);
    if (b >= 0) {
      if (b < toI32(this.values.length)) {
        this.values[b] = value;
      }
      return;
    }
    this.insertAt(-1 - b, key, h, value);
  }

  insertAt(b: i32, key: i32, h: u32, value: i32): void {
    if (b >= 0 && b < toI32(this.hashes.length) && b < toI32(this.keys.length) && b < toI32(this.values.length)) {
      this.hashes[b] = h;
      this.keys[b] = key;
      this.values[b] = value;
    }
    this.live = this.live + 1;
    if (this.live * 4 > toI32(this.hashes.length) * 3) {
      this.grow();
    }
  }

  /**
   * Linear probing's backward-shift delete: each later entry of the run that
   * may sit in the emptied bucket moves into it, so there are no tombstones
   * and a probe never walks past a deleted key.
   */
  delete(key: i32): boolean {
    let hole = this.probe(key, hashInt(key));
    if (hole < 0) {
      return false;
    }
    const n = toI32(this.hashes.length);
    let b = (hole + 1) & this.mask;
    while (b >= 0 && b < n && this.hashes[b] !== 0) {
      const want = home(this.hashes[b], this.mask);
      // The entry at `b` may move to `hole` when `hole` lies on its path, from `want` to `b`.
      if (((b - want) & this.mask) >= ((b - hole) & this.mask)) {
        if (hole >= 0 && hole < n && hole < toI32(this.keys.length) && hole < toI32(this.values.length) && b < toI32(this.keys.length) && b < toI32(this.values.length)) {
          this.hashes[hole] = this.hashes[b];
          this.keys[hole] = this.keys[b];
          this.values[hole] = this.values[b];
        }
        hole = b;
      }
      b = (b + 1) & this.mask;
    }
    if (hole >= 0 && hole < n) {
      this.hashes[hole] = 0;
    }
    this.live = this.live - 1;
    return true;
  }

  /** Double, re-filing every entry by its stored hash. */
  grow(): void {
    const oldHashes = this.hashes;
    const oldKeys = this.keys;
    const oldValues = this.values;
    const size = toI32(oldHashes.length) * 2;
    this.hashes = new Array<u32>(size);
    this.keys = new Array<i32>(size);
    this.values = new Array<i32>(size);
    this.mask = size - 1;
    for (let i = 0; i < toI32(oldHashes.length); i++) {
      const h = oldHashes[i];
      if (h !== 0) {
        let b = home(h, this.mask);
        while (b >= 0 && b < size && this.hashes[b] !== 0) {
          b = (b + 1) & this.mask;
        }
        if (b >= 0 && b < size && i < toI32(oldKeys.length) && i < toI32(oldValues.length)) {
          this.hashes[b] = h;
          this.keys[b] = oldKeys[i];
          this.values[b] = oldValues[i];
        }
      }
    }
  }

  /** Sum of the live values, walked in bucket order. */
  sum(): u32 {
    let total: u32 = 0;
    for (let i = 0; i < toI32(this.hashes.length) && i < toI32(this.values.length); i++) {
      if (this.hashes[i] !== 0) {
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
