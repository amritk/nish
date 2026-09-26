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
 * A program sees only the JavaScript members (§7), `size`, `get`, `set`/`add`,
 * `has`, `delete` and `clear`, and `keys()` and `values()` as the iterable of
 * a `for...of`. Neither `get` nor the iterators has a method here: `get`'s
 * `V | undefined` never crosses a call, so the compiler lowers it to `probe`
 * and, where found, `valueAt` (§3.2), and an iterator is not a value, so a
 * `for...of` over one is lowered to `walkOpen`, `walkNext`, `keyAt` or
 * `valueAt`, and `walkClose` (§6.2). The rest of this file is refused by name
 * outside it.
 */

/**
 * The most entries a table holds, dead ones included until a rebuild: 2^24 - 1,
 * what the 24-bit index field holds as an index plus one. Node's own `Map` and
 * `Set` hold one more, 2^24, and throw on the next insert.
 */
const INDEX_CAP: i32 = 16777215;

/** The first bucket count. A power of two, as every bucket count is. */
const INITIAL_SLOTS: i32 = 8;

/**
 * The key's hash, never 0: FNV-1a over a string's bytes, murmur3's `fmix32`
 * for an integer of 32 bits or fewer, `fmix64` folded to 32 bits for a 64-bit
 * integer, a float (normalised first, so that -0 and +0, and every NaN, hash
 * alike) and a class instance's address (§5.2). FNV, MurmurHash3 and their
 * constants are public domain.
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
  panic("collections: a probe ran out of buckets");
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
const compactHashes = (hashes: u32[]): void => {
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
    clearSlots(slots);
    return slots;
  }
  return new Array<u32>(n * 2);
};

/**
 * Re-file every live entry from its stored hash. After a compaction none is
 * dead; after a rebuild during a walk, which does not compact, a dead entry
 * keeps its place and takes no bucket, since no probe can find it.
 */
const refile = (slots: u32[], hashes: u32[]): void => {
  const mask = toI32(slots.length) - 1;
  for (let i: i32 = 0; i < toI32(hashes.length); i++) {
    const h = hashes[i];
    if (h !== 0) {
      fileEntry(slots, mask, h, i);
    }
  }
};

/**
 * `delete`'s write through a found probe result: the bucket becomes a
 * tombstone and the entry's stored hash 0. The key and value stay in the entry
 * until a rebuild compacts them away (§6.1).
 */
const killEntry = (slots: u32[], hashes: u32[], found: i64): void => {
  const at = toI32(found);
  const bucket = toI32(found >> 32);
  if (bucket >= 0 && bucket < toI32(slots.length)) {
    slots[bucket] = 16777216;
  }
  if (at >= 0 && at < toI32(hashes.length)) {
    hashes[at] = 0;
  }
};

/**
 * Zero every element in place: the buckets, which emptying a table and
 * compacting one both start with, and under a walk the stored hashes, which
 * is how `clear` marks every entry dead without moving one (§6.1).
 */
const clearSlots = (slots: u32[]): void => {
  for (let i: i32 = 0; i < toI32(slots.length); i++) {
    slots[i] = 0;
  }
};

/**
 * The index of the first live entry at `from` or after it, or -1 when there is
 * none: a `for...of` walk's step. It reads the entry count on every call, so
 * an entry appended during the walk is reached, and it skips a dead entry,
 * whose stored hash is 0, so a key deleted before the walk reaches it is not
 * visited (docs/wp32-map.md §6.2).
 */
const nextLive = (hashes: u32[], from: i32): i32 => {
  for (let i: i32 = from; i >= 0 && i < toI32(hashes.length); i++) {
    if (hashes[i] !== 0) {
      return i;
    }
  }
  return -1;
};

/** Drop every element of `items`, keeping its capacity. */
const truncate = <T>(items: T[]): void => {
  while (toI32(items.length) > 0) {
    items.pop();
  }
};

/**
 * Point bucket `bucket`, the empty one an absent probe stopped at, at the entry
 * just appended as index `used - 1`; or, when a rebuild made room first and
 * moved the buckets (`bucket` is -1), file it from its hash.
 */
const fileAppended = (slots: u32[], mask: i32, bucket: i32, h: u32, used: i32): void => {
  if (bucket >= 0 && bucket < toI32(slots.length)) {
    slots[bucket] = slotWord(h, used - 1);
  } else {
    fileEntry(slots, mask, h, used - 1);
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
  /**
   * How many `for...of` loops are walking the table now. While it is above 0
   * a rebuild doubles rather than compacts, and `clear` marks entries dead
   * rather than truncating, so no entry moves under a walk's cursor (§6.2).
   */
  walks: i32 = 0;

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
    killEntry(this.slots, this.entryHashes, found);
    this.live = this.live - 1;
    this.size = this.size - 1;
    return true;
  }

  /**
   * Empty the table in place: the buckets are zeroed and the entries
   * truncated, or, while a loop walks the table, marked dead and kept (§6.1).
   */
  clear(): void {
    clearSlots(this.slots);
    if (this.walks > 0) {
      clearSlots(this.entryHashes); // every entry dead, and the count kept
    } else {
      truncate(this.entryKeys);
      truncate(this.entryValues);
      truncate(this.entryHashes);
    }
    this.live = 0;
    this.size = 0;
  }

  /**
   * The four pieces a `for...of` over `keys()` or `values()` is lowered to
   * (`emitForOf`, docs/wp32-map.md §6.2): `walkOpen` where the loop is
   * entered, `walkNext` for the first live entry and after each pass,
   * `keyAt` or `valueAt` for the loop variable, and `walkClose` on every edge
   * that leaves the loop. Two stores a loop, and none per entry.
   */
  walkOpen(): void {
    this.walks = this.walks + 1;
  }

  walkNext(from: i32): i32 {
    return nextLive(this.entryHashes, from);
  }

  walkClose(): void {
    this.walks = this.walks - 1;
  }

  /** The key of entry `index`, which `walkNext` answered. */
  keyAt(index: i32): K {
    if (index < 0 || index >= toI32(this.entryKeys.length)) {
      panic("Map: no entry at this index");
    }
    return this.entryKeys[index];
  }

  /** The value of the entry a probe found, or a walk reached. */
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
      // Dead entries hold the cap: compact them away, then find the bucket
      // again. A walk defers compaction, so under one the cap is full.
      if (this.live >= INDEX_CAP || this.walks > 0) {
        panic("Map maximum size exceeded");
      }
      this.rebuild();
      bucket = -1;
    }
    this.entryKeys.push(storedKey(key));
    this.entryValues.push(value);
    this.entryHashes.push(h);
    this.live = this.live + 1;
    this.size = this.size + 1;
    // Every entry takes a bucket, live or dead, until a rebuild, which files
    // the new entry with the rest; otherwise it takes the bucket the probe found.
    const used = toI32(this.entryKeys.length);
    if (used * 4 > toI32(this.slots.length) * 3) {
      this.rebuild();
    } else {
      fileAppended(this.slots, this.mask, bucket, h, used);
    }
  }

  /**
   * Compact or double, then re-file the buckets from the stored hashes (§6.1).
   * While a loop walks the table it always doubles and moves no entry, and the
   * first rebuild after the walk compacts (§6.2).
   */
  rebuild(): void {
    const used = toI32(this.entryKeys.length);
    const walking = this.walks > 0;
    const slots = rebuiltSlots(this.slots, walking ? used : this.live, used);
    if (!walking && this.live < used) {
      compactEntries(this.entryKeys, this.entryHashes);
      compactEntries(this.entryValues, this.entryHashes);
      compactHashes(this.entryHashes);
    }
    this.slots = slots;
    this.mask = toI32(slots.length) - 1;
    refile(slots, this.entryHashes);
  }

  /**
   * `reserve(m, n)` from `nish/map` (docs/wp32-map.md §9.2): grow the bucket
   * table until `n` entries, dead ones included, fit under the load bound, so
   * that the inserts up to `n` rebuild nothing. It only ever grows the buckets
   * and re-files them from the stored hashes, so no entry moves and it is as
   * safe under a walk as the doubling a walk already allows (§6.2). A count
   * that is not positive, or not a number, does nothing, as `reserve` does
   * under Node; one past the entry cap is the cap.
   */
  reserveSlots(n: number): void {
    if (!(n > 0)) {
      return;
    }
    const want: i32 = n >= 16777215 ? INDEX_CAP : toI32(n);
    const have = toI32(this.slots.length);
    let size = have;
    while (want * 4 > size * 3) {
      size = size * 2;
    }
    if (size > have) {
      const slots = new Array<u32>(size);
      this.slots = slots;
      this.mask = size - 1;
      refile(slots, this.entryHashes);
    }
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
  /** `Map`'s walk count: how many `for...of` loops are walking the table now. */
  walks: i32 = 0;

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
    killEntry(this.slots, this.entryHashes, found);
    this.live = this.live - 1;
    this.size = this.size - 1;
    return true;
  }

  clear(): void {
    clearSlots(this.slots);
    if (this.walks > 0) {
      clearSlots(this.entryHashes); // every entry dead, and the count kept
    } else {
      truncate(this.entryKeys);
      truncate(this.entryHashes);
    }
    this.live = 0;
    this.size = 0;
  }

  /** `Map`'s walk: `for (const x of s)`, `s.keys()` and `s.values()` are all this one. */
  walkOpen(): void {
    this.walks = this.walks + 1;
  }

  walkNext(from: i32): i32 {
    return nextLive(this.entryHashes, from);
  }

  walkClose(): void {
    this.walks = this.walks - 1;
  }

  keyAt(index: i32): T {
    if (index < 0 || index >= toI32(this.entryKeys.length)) {
      panic("Set: no entry at this index");
    }
    return this.entryKeys[index];
  }

  insertAt(absent: i64, key: T): void {
    const packed = -1 - absent;
    let bucket = toI32(packed >> 32);
    const h = toU32(packed);
    if (toI32(this.entryKeys.length) >= INDEX_CAP) {
      if (this.live >= INDEX_CAP || this.walks > 0) {
        panic("Set maximum size exceeded");
      }
      this.rebuild();
      bucket = -1;
    }
    this.entryKeys.push(storedKey(key));
    this.entryHashes.push(h);
    this.live = this.live + 1;
    this.size = this.size + 1;
    // Every entry takes a bucket, live or dead, until a rebuild, which files
    // the new entry with the rest; otherwise it takes the bucket the probe found.
    const used = toI32(this.entryKeys.length);
    if (used * 4 > toI32(this.slots.length) * 3) {
      this.rebuild();
    } else {
      fileAppended(this.slots, this.mask, bucket, h, used);
    }
  }

  rebuild(): void {
    const used = toI32(this.entryKeys.length);
    const walking = this.walks > 0;
    const slots = rebuiltSlots(this.slots, walking ? used : this.live, used);
    if (!walking && this.live < used) {
      compactEntries(this.entryKeys, this.entryHashes);
      compactHashes(this.entryHashes);
    }
    this.slots = slots;
    this.mask = toI32(slots.length) - 1;
    refile(slots, this.entryHashes);
  }
}

/**
 * The key as an entry stores it: a float's -0 becomes +0, as ECMA-262's
 * `Map.prototype.set` and `Set.prototype.add` store it, so a walk over the
 * keys yields +0 whichever zero was inserted. Lowered in place, like `hashKey`
 * and `sameKey`: `fadd` of +0 for a float, and nothing at all for every other
 * key. It sits last in the file so that adding it moved no line a `-g` build
 * of an earlier function records.
 */
const storedKey = <K>(key: K): K => key;
