/**
 * `std/collections` — the global `Map` and `Set` (docs/wp32-map.md).
 *
 * A program does not import this module. Naming `Map` or `Set` is what loads
 * it, unless the module declares or imports a `Map` or `Set` of its own, and
 * the compiler emits every instance used, and every function here that it
 * reaches, into the module that uses it as `internal` functions. So this file
 * writes no `.ll` of its own, and a one-file program that names `Map` is still
 * one module (§4.1). Under Node, and under `tsc`, `Map` and `Set` are the
 * platform's, so nothing here runs there.
 *
 * **The layout is §2's.** Entries sit in insertion order in parallel arrays,
 * `entryKeys`, `entryValues` and `entryHashes`, and `entryHashes` holds the
 * full 32-bit hash of each. The bucket table `slots` is open addressing with
 * linear probing, and a bucket is one `u32`:
 *
 *     bits 31..24   the top eight bits of the key's hash (the fingerprint)
 *     bits 23..0    the entry's index plus one
 *
 * An empty bucket is 0. A deleted entry's bucket is `0x01000000` (16777216),
 * fingerprint 1 and index field 0, which no live entry has; its stored hash is
 * set to 0, which is why a computed hash of 0 is moved to 1. A probe reads the
 * entry arrays only when a bucket's fingerprint matches, and compares the
 * stored hash before the key, so a miss almost never touches a key, and a hit
 * compares one. Growth and compaction re-file the buckets from the stored
 * hashes and never hash a key again.
 *
 * **Every operation is one probe.** `probe` answers a packed `i64`: the entry
 * it found and the bucket that points at it, or the empty bucket it stopped at
 * and the key's hash. `set` and `add` insert through that result, and nothing
 * here asks `has` and then `set`. `probe`, `valueAt`, `setValueAt` and
 * `insertAt` are the pieces a fused lookup writes through, and they write
 * nothing but what their names say: `probe` writes no memory at all.
 *
 * A program sees only the JavaScript members (§7): `size`, `set`, `has`,
 * `delete` and `clear` on a `Map`, and `size`, `add`, `has`, `delete` and
 * `clear` on a `Set`. Everything else in this file is refused by name outside
 * it, as if it did not exist — which under `tsc` it does not.
 */

/**
 * The most entries a table holds: 2^24 - 1, what the 24-bit index field holds
 * as an index plus one. It is exactly the limit of Node's own `Map` and `Set`,
 * which throw at the 2^24-th entry.
 */
const INDEX_CAP: i32 = 16777215;

/** The first bucket count. A power of two, as every bucket count is. */
const INITIAL_SLOTS: i32 = 8;

/**
 * The key's hash, never 0: FNV-1a over a string's bytes, murmur3's `fmix32`
 * for an integer of 32 bits or fewer, `fmix64` folded to 32 bits for a 64-bit
 * integer, a float (normalised first, so that -0 and +0, and every NaN, hash
 * alike) and a class instance's address (§5.2).
 *
 * The body is never emitted. Every call is lowered in place, per key type, by
 * `self/emit_map.ts`; the constant is what the checker and the whole-program
 * facts see, and the facts of the function that calls it are what decide its
 * attributes, because every call is inside a probe that reads the table.
 */
const hashKey = <K>(key: K): u32 => 1;

/**
 * JavaScript's key equality, SameValueZero: `===`, except that NaN equals NaN.
 * Lowered in place per key type as well: `nish_str_eq` for a string, one
 * `icmp` for an integer, a boolean, an enum and a class instance, and for a
 * float `a == b` or both unordered.
 */
const sameKey = <K>(a: K, b: K): boolean => a === b;

/** The first bucket for `h`: its low bits, folded with the high half. */
const homeBucket = (h: u32, mask: i32): i32 => toI32(h ^ (h >>> 16)) & mask;

/** The bucket word for entry `index` of hash `h`. */
const slotWord = (h: u32, index: i32): u32 => ((h >>> 24) << 24) | toU32(index + 1);

/** A probe that found entry `index`, pointed at by `bucket`. Never negative. */
const foundAt = (bucket: i32, index: i32): i64 => (toI64(bucket) << 32) | toI64(index);

/** A probe that stopped at the empty `bucket` for hash `h`. Always negative. */
const absentAt = (bucket: i32, h: u32): i64 => toI64(-1) - ((toI64(bucket) << 32) | toI64(h));

/**
 * The one probe, for both classes: linear probing from `h`'s home bucket to
 * the bucket pointing at `key`, or to the first empty one. A tombstone is
 * walked past — its index field is 0, so its entry index is -1 and the range
 * test turns it away — and the load bound keeps a quarter of the buckets
 * empty, so the walk ends.
 */
const probeTable = <K>(slots: u32[], mask: i32, hashes: u32[], keys: K[], key: K): i64 => {
  const h = hashKey(key);
  const fingerprint = h >>> 24;
  let bucket = homeBucket(h, mask);
  // The length is read in the condition rather than once: the key compare is
  // a call, and a call ends every length fact the bounds proof holds.
  while (bucket >= 0 && bucket < toI32(slots.length)) {
    const word = slots[bucket];
    if (word === 0) {
      return absentAt(bucket, h);
    }
    if (word >>> 24 === fingerprint) {
      const at = toI32(word & 16777215) - 1;
      if (at >= 0 && at < toI32(hashes.length) && hashes[at] === h && at < toI32(keys.length) && sameKey(keys[at], key)) {
        return foundAt(bucket, at);
      }
    }
    bucket = (bucket + 1) & mask;
  }
  panic("Map: a probe ran out of buckets");
};

/**
 * Point the first empty bucket from `h`'s home at entry `index`. A rebuild's
 * re-filing: every key is already known to be distinct, so no key is
 * compared, and the stored hash is all it needs.
 */
const fileEntry = (slots: u32[], mask: i32, h: u32, index: i32): void => {
  const word = slotWord(h, index);
  let bucket = homeBucket(h, mask);
  while (bucket >= 0 && bucket < toI32(slots.length)) {
    if (slots[bucket] === 0) {
      slots[bucket] = word;
      return;
    }
    bucket = (bucket + 1) & mask;
  }
};

/** Slide the live entries of `items` down over the dead ones, in order, and drop the tail. */
const compactEntries = <T>(items: T[], hashes: u32[]): void => {
  const used = toI32(items.length);
  let to: i32 = 0;
  for (let from: i32 = 0; from < used && from < toI32(hashes.length); from++) {
    if (hashes[from] !== 0 && to >= 0 && to < used && from < toI32(items.length)) {
      items[to] = items[from];
      to++;
    }
  }
  while (toI32(items.length) > to) {
    items.pop();
  }
};

/** The stored hashes compacted the same way, last, since the two above read them. */
const compactHashes = (hashes: u32[]): i32 => {
  const used = toI32(hashes.length);
  let to: i32 = 0;
  for (let from: i32 = 0; from < used; from++) {
    const h = hashes[from];
    if (h !== 0 && to >= 0 && to < used) {
      hashes[to] = h;
      to++;
    }
  }
  while (toI32(hashes.length) > to) {
    hashes.pop();
  }
  return to;
};

/**
 * The bucket table after a rebuild of `live` entries out of `used`. More than
 * half dead compacts at the same size and clears the table in place — a new
 * array would leave the old one in the arena, once per compaction, which a
 * table that churns forever cannot afford (§6.1). Otherwise it doubles, and
 * the table never shrinks.
 */
const rebuiltSlots = (slots: u32[], live: i32, used: i32): u32[] => {
  const n = toI32(slots.length);
  if (live * 2 < used) {
    for (let i: i32 = 0; i < n; i++) {
      slots[i] = 0;
    }
    return slots;
  }
  return new Array<u32>(n * 2);
};

/** Re-file every entry from its stored hash; the entries are compacted, so none is dead. */
const refile = (slots: u32[], hashes: u32[]): void => {
  const mask = toI32(slots.length) - 1;
  for (let i: i32 = 0; i < toI32(hashes.length); i++) {
    fileEntry(slots, mask, hashes[i], i);
  }
};

/**
 * A key-value table in insertion order, with JavaScript's semantics: keys are
 * compared by SameValueZero, a key set again keeps its place, and a deleted key
 * set again goes to the end.
 */
// biome-ignore lint/suspicious/noShadowRestrictedNames: this is the global `Map`, which the compiler loads for a program that names it
export class Map<K, V> {
  /** How many entries are live. The one field a program may read, and it may not write it. */
  size: number = 0;
  /** Bucket -> fingerprint and entry index plus one; see the header. */
  slots: u32[];
  /** `slots.length - 1`: the table is a power of two. */
  mask: i32 = 7;
  /** Live entries, as an `i32` for the load and compaction arithmetic. */
  live: i32 = 0;
  entryKeys: K[];
  entryValues: V[];
  /** The full hash of each entry; 0 once the entry is deleted. */
  entryHashes: u32[];

  constructor() {
    this.slots = new Array<u32>(INITIAL_SLOTS);
    this.entryKeys = [];
    this.entryValues = [];
    this.entryHashes = [];
  }

  /** The packed probe result for `key`: see `probeTable`, `foundAt` and `absentAt`. */
  probe(key: K): i64 {
    return probeTable(this.slots, this.mask, this.entryHashes, this.entryKeys, key);
  }

  has(key: K): boolean {
    return this.probe(key) >= 0;
  }

  /** Set `key` to `value`, in place when it is there and at the end when it is not: one probe. */
  set(key: K, value: V): Map<K, V> {
    const found = this.probe(key);
    if (found >= 0) {
      this.setValueAt(toI32(found), value);
    } else {
      this.insertAt(found, key, value);
    }
    return this;
  }

  delete(key: K): boolean {
    const found = this.probe(key);
    if (found < 0) {
      return false;
    }
    const at = toI32(found);
    const bucket = toI32(found >> 32);
    if (bucket >= 0 && bucket < toI32(this.slots.length)) {
      this.slots[bucket] = 16777216;
    }
    if (at >= 0 && at < toI32(this.entryHashes.length)) {
      this.entryHashes[at] = 0;
    }
    this.live = this.live - 1;
    this.size = this.size - 1;
    return true;
  }

  /** Empty the table in place: the buckets are zeroed and the entries truncated. */
  clear(): void {
    const slots = this.slots;
    for (let i: i32 = 0; i < toI32(slots.length); i++) {
      slots[i] = 0;
    }
    while (toI32(this.entryKeys.length) > 0) {
      this.entryKeys.pop();
    }
    while (toI32(this.entryValues.length) > 0) {
      this.entryValues.pop();
    }
    while (toI32(this.entryHashes.length) > 0) {
      this.entryHashes.pop();
    }
    this.live = 0;
    this.size = 0;
  }

  /** The value of the entry a probe found. */
  valueAt(index: i32): V {
    if (index < 0 || index >= toI32(this.entryValues.length)) {
      panic("Map: no entry at this index");
    }
    return this.entryValues[index];
  }

  /** Overwrite the value of the entry a probe found; it keeps its place. */
  setValueAt(index: i32, value: V): void {
    if (index >= 0 && index < toI32(this.entryValues.length)) {
      this.entryValues[index] = value;
    }
  }

  /** Append an entry for `key` at the empty bucket an absent probe result names, reusing its hash. */
  insertAt(absent: i64, key: K, value: V): void {
    const packed = -1 - absent;
    let bucket = toI32(packed >> 32);
    const h = toU32(packed);
    if (toI32(this.entryKeys.length) >= INDEX_CAP) {
      if (this.live >= INDEX_CAP) {
        panic("Map maximum size exceeded");
      }
      // Dead entries hold the cap: compact them away, then find the bucket again.
      this.rebuild();
      bucket = -1;
    }
    this.entryKeys.push(key);
    this.entryValues.push(value);
    this.entryHashes.push(h);
    this.live = this.live + 1;
    this.size = this.size + 1;
    const used = toI32(this.entryKeys.length);
    if (bucket >= 0 && bucket < toI32(this.slots.length)) {
      this.slots[bucket] = slotWord(h, used - 1);
    } else {
      fileEntry(this.slots, this.mask, h, used - 1);
    }
    // Every entry takes a bucket, live or dead, until a rebuild.
    if (used * 4 > toI32(this.slots.length) * 3) {
      this.rebuild();
    }
  }

  /** Compact or double, then re-file the buckets from the stored hashes (§6.1). */
  rebuild(): void {
    const used = toI32(this.entryKeys.length);
    const slots = rebuiltSlots(this.slots, this.live, used);
    if (this.live < used) {
      compactEntries(this.entryKeys, this.entryHashes);
      compactEntries(this.entryValues, this.entryHashes);
      compactHashes(this.entryHashes);
    }
    this.slots = slots;
    this.mask = toI32(slots.length) - 1;
    refile(slots, this.entryHashes);
  }
}

/** A set of keys in insertion order: `Map`'s table with no values, and the same probe. */
// biome-ignore lint/suspicious/noShadowRestrictedNames: this is the global `Set`, which the compiler loads for a program that names it
export class Set<T> {
  /** How many elements are live. The one field a program may read, and it may not write it. */
  size: number = 0;
  slots: u32[];
  mask: i32 = 7;
  live: i32 = 0;
  entryKeys: T[];
  entryHashes: u32[];

  constructor() {
    this.slots = new Array<u32>(INITIAL_SLOTS);
    this.entryKeys = [];
    this.entryHashes = [];
  }

  probe(key: T): i64 {
    return probeTable(this.slots, this.mask, this.entryHashes, this.entryKeys, key);
  }

  has(key: T): boolean {
    return this.probe(key) >= 0;
  }

  /** Add `key` at the end when it is not there already: one probe. */
  add(key: T): Set<T> {
    const found = this.probe(key);
    if (found < 0) {
      this.insertAt(found, key);
    }
    return this;
  }

  delete(key: T): boolean {
    const found = this.probe(key);
    if (found < 0) {
      return false;
    }
    const at = toI32(found);
    const bucket = toI32(found >> 32);
    if (bucket >= 0 && bucket < toI32(this.slots.length)) {
      this.slots[bucket] = 16777216;
    }
    if (at >= 0 && at < toI32(this.entryHashes.length)) {
      this.entryHashes[at] = 0;
    }
    this.live = this.live - 1;
    this.size = this.size - 1;
    return true;
  }

  clear(): void {
    const slots = this.slots;
    for (let i: i32 = 0; i < toI32(slots.length); i++) {
      slots[i] = 0;
    }
    while (toI32(this.entryKeys.length) > 0) {
      this.entryKeys.pop();
    }
    while (toI32(this.entryHashes.length) > 0) {
      this.entryHashes.pop();
    }
    this.live = 0;
    this.size = 0;
  }

  insertAt(absent: i64, key: T): void {
    const packed = -1 - absent;
    let bucket = toI32(packed >> 32);
    const h = toU32(packed);
    if (toI32(this.entryKeys.length) >= INDEX_CAP) {
      if (this.live >= INDEX_CAP) {
        panic("Set maximum size exceeded");
      }
      this.rebuild();
      bucket = -1;
    }
    this.entryKeys.push(key);
    this.entryHashes.push(h);
    this.live = this.live + 1;
    this.size = this.size + 1;
    const used = toI32(this.entryKeys.length);
    if (bucket >= 0 && bucket < toI32(this.slots.length)) {
      this.slots[bucket] = slotWord(h, used - 1);
    } else {
      fileEntry(this.slots, this.mask, h, used - 1);
    }
    if (used * 4 > toI32(this.slots.length) * 3) {
      this.rebuild();
    }
  }

  rebuild(): void {
    const used = toI32(this.entryKeys.length);
    const slots = rebuiltSlots(this.slots, this.live, used);
    if (this.live < used) {
      compactEntries(this.entryKeys, this.entryHashes);
      compactHashes(this.entryHashes);
    }
    this.slots = slots;
    this.mask = toI32(slots.length) - 1;
    refile(slots, this.entryHashes);
  }
}
