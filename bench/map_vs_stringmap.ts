// WP32 comparison (d): the global `Map` against `StringMap`, the compiler's own
// table, on §2's workloads (docs/wp32-map.md §10).
//
// `StringMap` is compiler-internal and a bench program cannot import `self/`,
// so the block between the two `copy of self/map.ts` rules below is lines 28 to
// 204 of `self/map.ts` at a748d0b, byte for byte: `fnv1a` to the end of the
// class, as S6 left it, with fingerprints and stored hashes. `tests/run.js`'s
// `bench` check fails when the block is no longer a verbatim part of
// `self/map.ts`, so the two cannot drift apart; copy it again when that check
// fires. It is `string -> i32` and has no `delete`, so it runs `insert`, `hit`,
// `miss` and `count` over string keys, and `Map` runs all five workloads over
// both key kinds.
//
// Every workload is §2's: the same keys, drawn from the same LCG in the same
// order, so the ten lines this prints are the ones every `map_proto_*` program
// prints and bench/map_node.mjs, the Node twin, prints from Node's `Map`. The
// `StringMap` runs must reach the same checksums, which this program checks.
//
//   map_vs_stringmap [time] [map | stringmap]
//
// `time` prints each workload's elapsed nanoseconds to stderr as
// `time <workload> <kind> <table> <ns>`. Naming a table runs it alone, so that
// the harness times each in a process of its own; `stringmap` alone prints
// only its four lines.

// ---- copy of self/map.ts ----
/**
 * FNV-1a over the bytes of `key`. The round is a multiply that is *supposed*
 * to overflow, so it is done in `u32`, whose arithmetic is defined as wrapping
 * whatever `--wrapping` says; on a signed accumulator the same multiply would
 * be undefined under the default `nsw` (WP15 §3). FNV and its constants are
 * public domain.
 */
const fnv1a = (key: string): u32 => {
  let hash: u32 = 2166136261;
  let i = 0;
  while (i < key.length) {
    hash = hash ^ toU32(key.charCodeAt(i));
    hash = hash * 16777619;
    i = i + 1;
  }
  return hash;
};

/** The same hash as an `i32`: same bits, which is what the support oracle prints. */
export const hashString = (key: string): i32 => toI32(fnv1a(key));

/** The initial bucket count. Small: most scopes hold a handful of names. */
const INITIAL_SLOTS: i32 = 16;

/**
 * The most entries a 24-bit index-plus-one field holds, 2^24 - 1: Node's own
 * `Map` limit. It is also that field's mask, so the cap and the unpacking are
 * one number and cannot drift apart.
 */
const INDEX_CAP: i32 = 16777215;

/** The first bucket for `hash`: its low bits folded with its high half. */
export const home = (hash: u32, mask: i32): i32 => toI32(hash ^ (hash >>> 16)) & mask;

/** The eight hash bits a bucket keeps: the top of the hash, independent of `home`'s low bits. */
export const fingerprint = (hash: u32): u32 => hash >>> 24;

/** The bucket word for entry `index`: the fingerprint, then the index plus one. */
export const slotOf = (hash: u32, index: i32): u32 => (fingerprint(hash) << 24) | toU32(index + 1);

/** The entry index an occupied bucket word points at. */
export const entryOf = (slot: u32): i32 => toI32(slot & toU32(INDEX_CAP)) - 1;

export class StringMap {
  /** Bucket -> fingerprint in the top 8 bits, entry index plus one in the low 24. 0 is empty. */
  slots: u32[];
  /** `slots.length - 1`; the length is always a power of two. */
  mask: i32;
  /** The entries, in insertion order. */
  keys: string[];
  values: i32[];
  /** Each entry's full hash, so a probe and a rebuild never hash a key again. */
  hashes: u32[];

  constructor() {
    this.slots = new Array<u32>(INITIAL_SLOTS);
    this.mask = INITIAL_SLOTS - 1;
    this.keys = [];
    this.values = [];
    this.hashes = [];
  }

  /** How many entries the map holds. */
  size(): i32 {
    return this.keys.length;
  }

  keyAt(index: i32): string {
    return this.keys[index];
  }

  valueAt(index: i32): i32 {
    return this.values[index];
  }

  /**
   * The entry index of `key`, or `-1 - bucket` for the empty bucket it would
   * take: linear probing from its hash, one probe for a lookup and an insert
   * alike. A bucket is looked into only when its fingerprint matches, and its
   * entry's stored hash is compared before the key. The load factor below
   * keeps at least a quarter of the buckets empty, so this always terminates.
   */
  probe(key: string, hash: u32): i32 {
    const wanted = fingerprint(hash);
    let bucket = home(hash, this.mask);
    let slot = this.slots[bucket];
    while (slot !== 0) {
      if (fingerprint(slot) === wanted) {
        const at = entryOf(slot);
        if (this.hashes[at] === hash && this.keys[at] === key) {
          return at;
        }
      }
      bucket = (bucket + 1) & this.mask;
      slot = this.slots[bucket];
    }
    return -1 - bucket;
  }

  /** The entry index for `key`, or -1 when the map does not hold it. */
  find(key: string): i32 {
    const at = this.probe(key, fnv1a(key));
    return at < 0 ? -1 : at;
  }

  has(key: string): boolean {
    return this.find(key) >= 0;
  }

  /**
   * The value stored for `key`, or `missing`. There is no in-band sentinel:
   * a symbol table stores indices, and -1 is as good a value as any, so the
   * caller says what "absent" means.
   */
  get(key: string, missing: i32): i32 {
    const at = this.find(key);
    return at < 0 ? missing : this.values[at];
  }

  /** Insert `key`, or overwrite the value it already has. */
  set(key: string, value: i32): void {
    const hash = fnv1a(key);
    const at = this.probe(key, hash);
    if (at >= 0) {
      this.values[at] = value;
      return;
    }
    this.insertAt(-1 - at, key, hash, value);
  }

  /** Insert `key` unless the map holds it, leaving a value it has alone; true when it was absent. One probe either way. */
  add(key: string, value: i32): boolean {
    const hash = fnv1a(key);
    const at = this.probe(key, hash);
    if (at >= 0) {
      return false;
    }
    this.insertAt(-1 - at, key, hash, value);
    return true;
  }

  /** Append an entry and point `bucket`, the empty one a probe for `key` stopped at, to it. */
  insertAt(bucket: i32, key: string, hash: u32, value: i32): void {
    if (this.keys.length >= INDEX_CAP) {
      panic("StringMap maximum size exceeded");
    }
    this.keys.push(key);
    this.values.push(value);
    this.hashes.push(hash);
    this.slots[bucket] = slotOf(hash, this.keys.length - 1);
    // Grow at three quarters full, before the probe chains get long.
    if (this.keys.length * 4 > this.slots.length * 3) {
      this.grow();
    }
  }

  /**
   * Double the bucket table and re-file every entry from its stored hash. The
   * entries do not move, so insertion order — and every index a caller is
   * holding — survives, and no key is hashed or compared.
   */
  grow(): void {
    const wider = this.slots.length * 2;
    this.slots = new Array<u32>(wider);
    this.mask = wider - 1;
    let i = 0;
    while (i < this.keys.length) {
      const hash = this.hashes[i];
      let bucket = home(hash, this.mask);
      while (this.slots[bucket] !== 0) {
        bucket = (bucket + 1) & this.mask;
      }
      this.slots[bucket] = slotOf(hash, i);
      i = i + 1;
    }
  }
}
// ---- end of the copy of self/map.ts ----

/** A 32-bit LCG (Numerical Recipes); the top 24 bits are the draw. */
class Rng {
  state: u32 = 12345;

  next(): i32 {
    this.state = this.state * 1664525 + 1013904223;
    return toI32(this.state >>> 8);
  }
}

/** §2's `2n` distinct integer keys: `i * 2654435761` as an `i32`. */
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

const lap = (timing: boolean, label: string, started: i64): void => {
  if (timing) {
    writeError(`time ${label} ${monotonicNanos() - started}\n`);
  }
};

// ---- The global `Map`, on the five workloads of §2 ----

const fillStrMap = (keys: string[], n: i32): Map<string, i32> => {
  const m = new Map<string, i32>();
  for (let i = 0; i < n && i < toI32(keys.length); i++) {
    m.set(keys[i], i);
  }
  return m;
};

const fillIntMap = (keys: i32[], n: i32): Map<i32, i32> => {
  const m = new Map<i32, i32>();
  for (let i = 0; i < n && i < toI32(keys.length); i++) {
    m.set(keys[i], i);
  }
  return m;
};

const sumStrMap = (m: Map<string, i32>): u32 => {
  let total: u32 = 0;
  for (const v of m.values()) {
    total = total + toU32(v);
  }
  return total;
};

const sumIntMap = (m: Map<i32, i32>): u32 => {
  let total: u32 = 0;
  for (const v of m.values()) {
    total = total + toU32(v);
  }
  return total;
};

/** The five workloads on `Map<string, i32>`; answers their checksum lines. */
const runStrMap = (keys: string[], n: i32, timing: boolean): string[] => {
  const lines: string[] = [];
  const mask = n - 1;
  const rng = new Rng();
  let t = clock(timing);
  let built = 0;
  for (let round = 0; round < 3; round++) {
    built = built + fillStrMap(keys, n).size;
  }
  const m = fillStrMap(keys, n);
  lines.push(`insert str ${built + m.size} ${sumStrMap(m)}`);
  lap(timing, "insert str map", t);

  t = clock(timing);
  let hits: u32 = 0;
  for (let j = 0; j < 8 * n; j++) {
    const at = rng.next() & mask;
    if (at >= 0 && at < toI32(keys.length)) {
      hits = hits + toU32(m.get(keys[at]) ?? -1);
    }
  }
  lines.push(`hit str ${hits}`);
  lap(timing, "hit str map", t);

  t = clock(timing);
  let misses: u32 = 0;
  for (let j = 0; j < 8 * n; j++) {
    const at = n + (rng.next() & mask);
    if (at >= 0 && at < toI32(keys.length)) {
      misses = misses + toU32(m.get(keys[at]) ?? j & 7);
    }
  }
  lines.push(`miss str ${misses}`);
  lap(timing, "miss str map", t);

  t = clock(timing);
  const vocab = n / 4;
  const counts = new Map<string, i32>();
  for (let j = 0; j < 8 * n; j++) {
    const at = rng.next() & rng.next() & (vocab - 1);
    if (at >= 0 && at < toI32(keys.length)) {
      const w = keys[at];
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  let weighted: u32 = 0;
  for (let i = 0; i < vocab && i < toI32(keys.length); i++) {
    weighted = weighted + toU32(counts.get(keys[i]) ?? 0) * toU32(i);
  }
  lines.push(`count str ${counts.size} ${weighted}`);
  lap(timing, "count str map", t);

  t = clock(timing);
  const window = n / 2;
  const pool = 2 * n - 1;
  const churn = new Map<string, i32>();
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
  lines.push(`churn str ${churn.size} ${sumStrMap(churn)}`);
  lap(timing, "churn str map", t);
  return lines;
};

/** The five workloads on `Map<i32, i32>`; answers their checksum lines. */
const runIntMap = (keys: i32[], n: i32, timing: boolean): string[] => {
  const lines: string[] = [];
  const mask = n - 1;
  const rng = new Rng();
  let t = clock(timing);
  let built = 0;
  for (let round = 0; round < 3; round++) {
    built = built + fillIntMap(keys, n).size;
  }
  const m = fillIntMap(keys, n);
  lines.push(`insert int ${built + m.size} ${sumIntMap(m)}`);
  lap(timing, "insert int map", t);

  t = clock(timing);
  let hits: u32 = 0;
  for (let j = 0; j < 8 * n; j++) {
    const at = rng.next() & mask;
    if (at >= 0 && at < toI32(keys.length)) {
      hits = hits + toU32(m.get(keys[at]) ?? -1);
    }
  }
  lines.push(`hit int ${hits}`);
  lap(timing, "hit int map", t);

  t = clock(timing);
  let misses: u32 = 0;
  for (let j = 0; j < 8 * n; j++) {
    const at = n + (rng.next() & mask);
    if (at >= 0 && at < toI32(keys.length)) {
      misses = misses + toU32(m.get(keys[at]) ?? j & 7);
    }
  }
  lines.push(`miss int ${misses}`);
  lap(timing, "miss int map", t);

  t = clock(timing);
  const vocab = n / 4;
  const counts = new Map<i32, i32>();
  for (let j = 0; j < 8 * n; j++) {
    const at = rng.next() & rng.next() & (vocab - 1);
    if (at >= 0 && at < toI32(keys.length)) {
      const w = keys[at];
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  let weighted: u32 = 0;
  for (let i = 0; i < vocab && i < toI32(keys.length); i++) {
    weighted = weighted + toU32(counts.get(keys[i]) ?? 0) * toU32(i);
  }
  lines.push(`count int ${counts.size} ${weighted}`);
  lap(timing, "count int map", t);

  t = clock(timing);
  const window = n / 2;
  const pool = 2 * n - 1;
  const churn = new Map<i32, i32>();
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
  lines.push(`churn int ${churn.size} ${sumIntMap(churn)}`);
  lap(timing, "churn int map", t);
  return lines;
};

// ---- `StringMap`, on the four workloads it can run ----

const fillStringMap = (keys: string[], n: i32): StringMap => {
  const m = new StringMap();
  for (let i = 0; i < n && i < toI32(keys.length); i++) {
    m.set(keys[i], i);
  }
  return m;
};

/** Sum of the values, walked in insertion order. */
const sumStringMap = (m: StringMap): u32 => {
  let total: u32 = 0;
  for (let i = 0; i < m.size(); i++) {
    total = total + toU32(m.valueAt(i));
  }
  return total;
};

/** `insert`, `hit`, `miss` and `count` on `StringMap`; answers their checksum lines. */
const runStringMap = (keys: string[], n: i32, timing: boolean): string[] => {
  const lines: string[] = [];
  const mask = n - 1;
  const rng = new Rng();
  let t = clock(timing);
  let built = 0;
  for (let round = 0; round < 3; round++) {
    built = built + fillStringMap(keys, n).size();
  }
  const m = fillStringMap(keys, n);
  lines.push(`insert str ${built + m.size()} ${sumStringMap(m)}`);
  lap(timing, "insert str stringmap", t);

  t = clock(timing);
  let hits: u32 = 0;
  for (let j = 0; j < 8 * n; j++) {
    const at = rng.next() & mask;
    if (at >= 0 && at < toI32(keys.length)) {
      hits = hits + toU32(m.get(keys[at], -1));
    }
  }
  lines.push(`hit str ${hits}`);
  lap(timing, "hit str stringmap", t);

  t = clock(timing);
  let misses: u32 = 0;
  for (let j = 0; j < 8 * n; j++) {
    const at = n + (rng.next() & mask);
    if (at >= 0 && at < toI32(keys.length)) {
      misses = misses + toU32(m.get(keys[at], j & 7));
    }
  }
  lines.push(`miss str ${misses}`);
  lap(timing, "miss str stringmap", t);

  // One probe a word, as `Map`'s fused count and the prototypes' `add` are:
  // the probe's answer is the entry to bump or the bucket to insert at.
  t = clock(timing);
  const vocab = n / 4;
  const counts = new StringMap();
  for (let j = 0; j < 8 * n; j++) {
    const at = rng.next() & rng.next() & (vocab - 1);
    if (at >= 0 && at < toI32(keys.length)) {
      const w = keys[at];
      const hash = fnv1a(w);
      const found = counts.probe(w, hash);
      if (found >= 0) {
        counts.values[found] = counts.values[found] + 1;
      } else {
        counts.insertAt(-1 - found, w, hash, 1);
      }
    }
  }
  let weighted: u32 = 0;
  for (let i = 0; i < vocab && i < toI32(keys.length); i++) {
    weighted = weighted + toU32(counts.get(keys[i], 0)) * toU32(i);
  }
  lines.push(`count str ${counts.size()} ${weighted}`);
  lap(timing, "count str stringmap", t);
  return lines;
};

export const main = (): i32 => {
  // The key count; a power of two, because the workloads draw an index by masking.
  const n: i32 = 65536; // bench:n
  const timing = process.argv.length > 1 && process.argv[1] === "time";
  const at = timing ? 2 : 1;
  const only = process.argv.length > at ? process.argv[at] : "";
  const ints = intKeys(n);
  const strs = strKeys(ints);
  const byStringMap: string[] = only === "" || only === "stringmap" ? runStringMap(strs, n, timing) : [];
  if (only === "stringmap") {
    for (const line of byStringMap) {
      console.log(line);
    }
    return 0;
  }
  const byMap = runStrMap(strs, n, timing);
  for (let i = 0; i < toI32(byStringMap.length) && i < toI32(byMap.length); i++) {
    if (byStringMap[i] !== byMap[i]) {
      panic(`Map and StringMap disagree: ${byMap[i]} against ${byStringMap[i]}`);
    }
  }
  for (const line of byMap) {
    console.log(line);
  }
  for (const line of runIntMap(ints, n, timing)) {
    console.log(line);
  }
  return 0;
};
