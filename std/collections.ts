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
 *     const counts = new Map<string, i32>()
 *     const seen = new Set<string>()
 *     for (const w of ["to", "be", "or", "not", "to", "be"]) {
 *       counts.set(w, (counts.get(w) ?? 0) + 1)
 *       seen.add(w)
 *     }
 *     for (const w of counts.keys()) {
 *       console.log(`${w} ${counts.get(w) ?? 0}`)  // "to 2", "be 2", "or 1", ...
 *     }
 *     seen.size  // 4, and seen.has("or") is true
 *
 * **The layout is §2's.** Entries sit in insertion order in parallel arrays,
 * `entryKeys`, `entryValues` and `entryHashes`, and `entryHashes` holds the
 * full 32-bit hash of each. The bucket table `slots` is open addressing with
 * linear probing, and a bucket is one `u32`:
 *
 *     the high bits   the key's hash above the table's mask (the fingerprint)
 *     the mask bits   the entry's index plus one
 *
 * The index field is as wide as the mask, `slots.length - 1`: a table holds
 * at most three entries per four buckets, so every index plus one fits. An
 * empty bucket is 0. A deleted entry's bucket is the mask plus one,
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
 * The key's hash, never 0: SipHash-1-3 of a string's bytes under the process's
 * random key, folded to 32 bits (docs/security/json.md, JSON-13); under a 2nd,
 * multiply-add-shift for an int of 32 bits or fewer, a boolean or an enum, a
 * folded 128-bit multiply for a 64-bit int; `fmix64` folded to 32 bits for a
 * float (normalised first, so -0 and +0, and every NaN, hash alike) and a class
 * address (§5.2). SipHash's reference is CC0; MurmurHash3 is public domain.
 *
 * The body is never emitted. Every call is lowered in place, per key type, by
 * `src/emit-map.ts`; the constant is what the checker and the whole-program
 * facts see, and the facts of the function that calls it are what decide its
 * attributes, because every call is inside a probe that reads the table.
 */
const hashKey = <K>(_key: K): u32 => 1

/**
 * JavaScript's key equality, SameValueZero: `===`, except that NaN equals NaN.
 * Lowered in place per key type as well: `nish_str_eq` for a string, one
 * `icmp` for an integer, a boolean, an enum and a class instance, and for a
 * float `a == b` or both unordered.
 */
const sameKey = <K>(a: K, b: K): boolean => a === b

/** The first bucket for `h`: its low bits, folded with the high half. */
const homeBucket = (h: u32, mask: i32): i32 => toI32(h ^ (h >>> 16)) & mask

/**
 * The bucket word for entry `index` of hash `h` in a table of `mask + 1`
 * buckets: the index plus one in the bits the mask covers, and the hash's bits
 * above them as a fingerprint. The load bound keeps every index below the
 * bucket count, so the index never reaches the fingerprint.
 */
const slotWord = (h: u32, mask: i32, index: i32): u32 => (h & ~toU32(mask)) | (toU32(index) + 1)

/**
 * A deleted entry's bucket: a fingerprint bit set and an index field of 0, so
 * a probe walks past it, its entry index being -1.
 */
const tombstone = (mask: i32): u32 => toU32(mask) + 1

/** A probe that found entry `index`, pointed at by `bucket`. Never negative. */
const foundAt = (bucket: i32, index: i32): i64 => (toI64(bucket) << 32) | toI64(index)

/** A probe that stopped at the empty `bucket` for hash `h`. Always negative. */
const absentAt = (bucket: i32, h: u32): i64 => ~((toI64(bucket) << 32) | toI64(h))

/**
 * The one probe, for both classes: linear probing from `h`'s home bucket to
 * the bucket pointing at `key`, or to the first empty one. A tombstone is
 * walked past — its index field is 0, so its entry index is -1 and the range
 * test turns it away — and the load bound keeps a quarter of the buckets
 * empty, so the walk ends. It takes at most one step per bucket: a table with
 * no empty bucket answers absent at the bucket past its end, which
 * `insertAt` answers with a rebuild, as it does a full table.
 */
const probeTable = <K>(slots: u32[], mask: i32, hashes: u32[], keys: K[], key: K): i64 => {
  const h = hashKey(key)
  const low = toU32(mask)
  const fingerprint = h & ~low
  let bucket = toU32(homeBucket(h, mask))
  // The length is read in the condition rather than once: the key compare is
  // a call, and a call ends every length fact the bounds proof holds. The
  // step and the bucket are `u32`s, whose `+` wraps, so the call leaves
  // nothing they need proven.
  for (let step: u32 = 0; step < toU32(slots.length); step = step + 1) {
    const b = toI32(bucket)
    if (b >= 0 && b < toI32(slots.length)) {
      const word = slots[b]
      if (word === 0) {
        return absentAt(b, h)
      }
      if ((word & ~low) === fingerprint) {
        const at = toI32((word & low) - 1)
        if (
          at >= 0 &&
          at < toI32(hashes.length) &&
          hashes[at] === h &&
          at < toI32(keys.length) &&
          sameKey(keys[at], key)
        ) {
          return foundAt(b, at)
        }
      }
    }
    bucket = (bucket + 1) & low
  }
  return absentAt(toI32(slots.length), h)
}

/**
 * Point the first empty bucket from `h`'s home at entry `index`. A rebuild's
 * re-filing: every key is already known to be distinct, so no key is
 * compared, and the stored hash is all it needs. The load bound leaves a
 * quarter of the buckets empty, so one pass finds one.
 */
const fileEntry = (slots: u32[], mask: i32, h: u32, index: i32): void => {
  const word = slotWord(h, mask, index)
  const low = toU32(mask)
  let bucket = toU32(homeBucket(h, mask))
  for (let step: u32 = 0; step < toU32(slots.length); step = step + 1) {
    const b = toI32(bucket)
    if (b >= 0 && b < toI32(slots.length) && slots[b] === 0) {
      slots[b] = word
      return
    }
    bucket = (bucket + 1) & low
  }
}

/** Slide the live entries of `items` down over the dead ones, in order, and drop the tail. */
const compactEntries = <T>(items: T[], hashes: u32[]): void => {
  const used = toI32(items.length)
  let to: i32 = 0
  for (let from: i32 = 0; from < used && from < toI32(hashes.length); from++) {
    if (hashes[from] !== 0 && to >= 0 && to < used && from < toI32(items.length)) {
      items[to] = items[from]
      to++
    }
  }
  while (toI32(items.length) > to && items.length > 0) {
    items.pop()
  }
}

/** The stored hashes compacted the same way, last, since the two above read them. */
const compactHashes = (hashes: u32[]): void => {
  const used = toI32(hashes.length)
  let to: i32 = 0
  for (let from: i32 = 0; from < used; from++) {
    const h = hashes[from]
    if (h !== 0 && to >= 0 && to < used) {
      hashes[to] = h
      to++
    }
  }
  while (toI32(hashes.length) > to && hashes.length > 0) {
    hashes.pop()
  }
}

/**
 * The bucket table after a rebuild of `live` entries out of `used`. More than
 * half dead compacts at the same size and clears the table in place — a new
 * array would leave the old one in the arena, once per compaction, which a
 * table that churns forever cannot afford (§6.1). Otherwise it doubles, and
 * the table never shrinks.
 */
const rebuiltSlots = (slots: u32[], live: i32, used: i32): u32[] => {
  if (toI64(live) * 2 < toI64(used)) {
    clearSlots(slots)
    return slots
  }
  return emptySlots(slots, 2)
}

/**
 * A new bucket table of `times` empty buckets for each of `slots`'. It is
 * built by `push`, so a table past the largest array, 2^31 - 1 elements, stops
 * the program as out of memory, as any allocation that size does: that is a
 * `Map` or `Set` of more than 2^29 entries. (Node's hold 2^24 and throw on
 * the next insert.)
 */
const emptySlots = (slots: u32[], times: i32): u32[] => {
  const out: u32[] = []
  for (let i: i32 = 0; i < toI32(slots.length); i++) {
    for (let j: i32 = 0; j < times; j++) {
      out.push(0)
    }
  }
  return out
}

/**
 * Re-file every live entry from its stored hash. After a compaction none is
 * dead; after a rebuild during a walk, which does not compact, a dead entry
 * keeps its place and takes no bucket, since no probe can find it.
 */
const refile = (slots: u32[], hashes: u32[]): void => {
  const mask = toI32(slots.length) - 1
  for (let i: i32 = 0; i < toI32(hashes.length); i++) {
    const h = hashes[i]
    if (h !== 0) {
      fileEntry(slots, mask, h, i)
    }
  }
}

/**
 * `delete`'s write through a found probe result: the bucket becomes a
 * tombstone and the entry's stored hash 0. The key and value stay in the entry
 * until a rebuild compacts them away (§6.1).
 */
const killEntry = (slots: u32[], mask: i32, hashes: u32[], found: i64): void => {
  const at = toI32(found)
  const bucket = toI32(found >> 32)
  if (bucket >= 0 && bucket < toI32(slots.length)) {
    slots[bucket] = tombstone(mask)
  }
  if (at >= 0 && at < toI32(hashes.length)) {
    hashes[at] = 0
  }
}

/**
 * Zero every element in place: the buckets, which emptying a table and
 * compacting one both start with, and under a walk the stored hashes, which
 * is how `clear` marks every entry dead without moving one (§6.1).
 */
const clearSlots = (slots: u32[]): void => {
  for (let i: i32 = 0; i < toI32(slots.length); i++) {
    slots[i] = 0
  }
}

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
      return i
    }
  }
  return -1
}

/** Drop every element of `items`, keeping its capacity. */
const truncate = <T>(items: T[]): void => {
  while (toI32(items.length) > 0) {
    items.pop()
  }
}

/**
 * Point bucket `bucket`, the empty one an absent probe stopped at, at the entry
 * just appended to `hashes`, and answer true; or answer false, and file
 * nothing, when the entry needs a rebuild first: the bucket is past the end,
 * or the entries, dead ones included, are past the load bound of three
 * quarters of the buckets.
 */
const fileAppended = (slots: u32[], mask: i32, bucket: i32, hashes: u32[]): boolean => {
  const used = toI32(hashes.length)
  const size = toI32(slots.length)
  if (toI64(used) * 4 > toI64(size) * 3 || bucket < 0 || bucket >= size) {
    return false
  }
  if (used > 0) {
    slots[bucket] = slotWord(hashes[used - 1], mask, used - 1)
  }
  return true
}

/**
 * A key-value table in insertion order, with JavaScript's semantics: keys are
 * compared by SameValueZero, a key set again keeps its place, and a deleted key
 * set again goes to the end.
 */
// biome-ignore lint/suspicious/noShadowRestrictedNames: this is the global `Map`, which the compiler loads for a program that names it
export class Map<K, V> {
  /** How many entries are live. The one field a program may read, and it may not write it. */
  size: number = 0
  /** Bucket -> fingerprint and entry index plus one; see the header. */
  private slots: u32[]
  /** `slots.length - 1`: the table is a power of two. */
  private mask: i32 = 7
  /** Live entries, as an `i32` for the load and compaction arithmetic. */
  private live: i32 = 0
  private entryKeys: K[]
  private entryValues: V[]
  /** The full hash of each entry; 0 once the entry is deleted. */
  private entryHashes: u32[]
  /**
   * How many `for...of` loops are walking the table now. While it is above 0
   * a rebuild doubles rather than compacts, and `clear` marks entries dead
   * rather than truncating, so no entry moves under a walk's cursor (§6.2).
   */
  private walks: u32 = 0

  /** An empty map. */
  constructor() {
    this.slots = new Array<u32>(8)
    this.entryKeys = []
    this.entryValues = []
    this.entryHashes = []
  }

  /**
   * The packed probe result for `key`: see `probeTable`, `foundAt` and
   * `absentAt`.
   *
   * @internal Called by name by the code the compiler writes for a `Map`,
   *   src/emit-map.ts.
   */
  probe(key: K): i64 {
    return probeTable(this.slots, this.mask, this.entryHashes, this.entryKeys, key)
  }

  /**
   * Whether the map has an entry for `key`.
   *
   * @param key - the key to look for, compared by SameValueZero: `===`, except
   *   that NaN equals NaN.
   * @returns true when there is an entry.
   */
  has(key: K): boolean {
    return this.probe(key) >= 0
  }

  /**
   * Set `key` to `value`, in place when it is there and at the end when it is
   * not: one probe.
   *
   * @param key - the entry's key.
   * @param value - the value to store.
   * @returns the map itself, so that calls chain.
   */
  set(key: K, value: V): Map<K, V> {
    const found = this.probe(key)
    if (found >= 0) {
      this.setValueAt(toI32(found), value)
    } else {
      this.insertAt(found, key, value)
    }
    return this
  }

  /**
   * Removes the entry for `key`, if there is one; the others keep their order.
   *
   * @param key - the key to remove.
   * @returns true when there was an entry to remove.
   */
  delete(key: K): boolean {
    const found = this.probe(key)
    if (found < 0) {
      return false
    }
    killEntry(this.slots, this.mask, this.entryHashes, found)
    this.dropOne()
    return true
  }

  /**
   * Empty the table in place: the buckets are zeroed and the entries
   * truncated, or, while a loop walks the table, marked dead and kept (§6.1).
   */
  clear(): void {
    clearSlots(this.slots)
    if (this.walks > 0) {
      clearSlots(this.entryHashes) // every entry dead, and the count kept
    } else {
      truncate(this.entryKeys)
      truncate(this.entryValues)
      truncate(this.entryHashes)
    }
    this.live = 0
    this.size = 0
  }

  /**
   * The four pieces a `for...of` over `keys()` or `values()` is lowered to
   * (`emitForOf`, docs/wp32-map.md §6.2): `walkOpen` where the loop is
   * entered, `walkNext` for the first live entry and after each pass,
   * `keyAt` or `valueAt` for the loop variable, and `walkClose` on every edge
   * that leaves the loop. Two stores a loop, and none per entry.
   *
   * @internal Called by name by the code the compiler writes for a `Map`,
   *   src/emit-map.ts.
   */
  walkOpen(): void {
    this.walks = this.walks + 1 // a `u32`: no program nests 2^32 walks
  }

  /** @internal Called by name by the code the compiler writes for a `Map`, src/emit-map.ts. */
  walkNext(from: i32): i32 {
    return nextLive(this.entryHashes, from)
  }

  /** @internal Called by name by the code the compiler writes for a `Map`, src/emit-map.ts. */
  walkClose(): void {
    this.walks = this.walks - 1
  }

  /**
   * The key of entry `index`, which `walkNext` answered.
   *
   * @internal Called by name by the code the compiler writes for a `Map`,
   *   src/emit-map.ts.
   */
  keyAt(index: i32, none: K): K {
    if (index >= 0 && index < toI32(this.entryKeys.length)) {
      return this.entryKeys[index]
    }
    return none
  }

  /**
   * The value of the entry a probe found, or a walk reached.
   *
   * @internal Called by name by the code the compiler writes for a `Map`,
   *   src/emit-map.ts.
   */
  valueAt(index: i32, none: V): V {
    if (index >= 0 && index < toI32(this.entryValues.length)) {
      return this.entryValues[index]
    }
    return none
  }

  /**
   * Overwrite the value of the entry a probe found; it keeps its place.
   *
   * @internal Called by name by the code the compiler writes for a `Map`,
   *   src/emit-map.ts.
   */
  setValueAt(index: i32, value: V): void {
    if (index >= 0 && index < toI32(this.entryValues.length)) {
      this.entryValues[index] = value
    }
  }

  /**
   * Append an entry for `key` at the empty bucket an absent probe result names,
   * reusing its hash.
   *
   * @internal Called by name by the code the compiler writes for a `Map`,
   *   src/emit-map.ts.
   */
  insertAt(absent: i64, key: K, value: V): void {
    const packed = -1 - absent
    this.entryKeys.push(storedKey(key))
    this.entryValues.push(value)
    this.entryHashes.push(toU32(packed))
    this.addOne()
    // Every entry takes a bucket, live or dead, until a rebuild, which files
    // the new entry with the rest; otherwise it takes the bucket the probe found.
    if (!fileAppended(this.slots, this.mask, toI32(packed >> 32), this.entryHashes)) {
      this.rebuild()
    }
  }

  /**
   * Count one more live entry. The entries, dead ones included, are fewer
   * than 2^31 - 1, the most an array holds, so neither count is ever at the
   * bound the test names.
   */
  private addOne(): void {
    const live = this.live
    if (live < 2147483647) {
      this.live = live + 1
    }
    const size = this.size
    if (size < 2147483647) {
      this.size = size + 1
    }
  }

  /** Count one live entry fewer: `delete`'s, which found one, so neither count is 0. */
  private dropOne(): void {
    const live = this.live
    if (live > 0) {
      this.live = live - 1
    }
    const size = this.size
    if (size > 0) {
      this.size = size - 1
    }
  }

  /**
   * Compact or double, then re-file the buckets from the stored hashes (§6.1).
   * While a loop walks the table it always doubles and moves no entry, and the
   * first rebuild after the walk compacts (§6.2).
   */
  private rebuild(): void {
    const used = toI32(this.entryKeys.length)
    const walking = this.walks > 0
    const slots = rebuiltSlots(this.slots, walking ? used : this.live, used)
    if (!walking && this.live < used) {
      compactEntries(this.entryKeys, this.entryHashes)
      compactEntries(this.entryValues, this.entryHashes)
      compactHashes(this.entryHashes)
    }
    this.slots = slots
    this.mask = toI32(slots.length) - 1
    refile(slots, this.entryHashes)
  }

  /**
   * `reserve(m, n)` from `nish/map` (docs/wp32-map.md §9.2): grow the bucket
   * table until `n` entries, dead ones included, fit under the load bound, so
   * that the inserts up to `n` rebuild nothing. It only ever grows the buckets
   * and re-files them from the stored hashes, so no entry moves and it is as
   * safe under a walk as the doubling a walk already allows (§6.2). A count
   * that is not positive, or not a number, does nothing, as `reserve` does
   * under Node. The table grows to at most 2^30 buckets, the largest power of
   * two an array holds; filling one that size runs out of memory first.
   *
   * @internal Called by name by the code the compiler writes for `reserve` from
   *   `nish/map`, src/emit-map.ts.
   */
  reserveSlots(n: number): void {
    const want = toF64(n)
    if (!(want > 0)) {
      return
    }
    // In `f64`, which has no overflow to prove away.
    const have = toF64(toI32(this.slots.length))
    let size = have
    while (want * 4 > size * 3 && size < 1073741824) {
      size = size * 2
    }
    if (size > have && have > 0) {
      const slots = emptySlots(this.slots, toI32(size / have))
      this.slots = slots
      this.mask = toI32(slots.length) - 1
      refile(slots, this.entryHashes)
    }
  }

  /**
   * The entry keys, dead ones included, for `forEachEntry`'s walk to index
   * with what `walkNext` found. Read again after every call it makes, since
   * `clear` replaces them.
   *
   * @internal Called by `forEachEntry`, `forEachValue` and `forEachElement`.
   */
  walkKeys(): K[] {
    return this.entryKeys
  }

  /**
   * The entry values, as `walkKeys`.
   *
   * @internal Called by `forEachEntry` and `forEachValue`.
   */
  walkValues(): V[] {
    return this.entryValues
  }
}

/** A set of keys in insertion order: `Map`'s table with no values, and the same probe. */
// biome-ignore lint/suspicious/noShadowRestrictedNames: this is the global `Set`, which the compiler loads for a program that names it
export class Set<T> {
  /** How many elements are live. The one field a program may read, and it may not write it. */
  size: number = 0
  private slots: u32[]
  private mask: i32 = 7
  private live: i32 = 0
  private entryKeys: T[]
  private entryHashes: u32[]
  /** `Map`'s walk count: how many `for...of` loops are walking the table now. */
  private walks: u32 = 0

  /** An empty set. */
  constructor() {
    this.slots = new Array<u32>(8)
    this.entryKeys = []
    this.entryHashes = []
  }

  /** @internal Called by name by the code the compiler writes for a `Set`, src/emit-map.ts. */
  probe(key: T): i64 {
    return probeTable(this.slots, this.mask, this.entryHashes, this.entryKeys, key)
  }

  /**
   * Whether `key` is in the set.
   *
   * @param key - the key to look for, compared by SameValueZero: `===`, except
   *   that NaN equals NaN.
   * @returns true when it is.
   */
  has(key: T): boolean {
    return this.probe(key) >= 0
  }

  /**
   * Add `key` at the end when it is not there already: one probe.
   *
   * @param key - the key to add.
   * @returns the set itself, so that calls chain.
   */
  add(key: T): Set<T> {
    const found = this.probe(key)
    if (found < 0) {
      this.insertAt(found, key)
    }
    return this
  }

  /**
   * Removes `key`, if it is there; the others keep their order.
   *
   * @param key - the key to remove.
   * @returns true when there was a key to remove.
   */
  delete(key: T): boolean {
    const found = this.probe(key)
    if (found < 0) {
      return false
    }
    killEntry(this.slots, this.mask, this.entryHashes, found)
    this.dropOne()
    return true
  }

  /** Removes every key, keeping the table's memory. */
  clear(): void {
    clearSlots(this.slots)
    if (this.walks > 0) {
      clearSlots(this.entryHashes) // every entry dead, and the count kept
    } else {
      truncate(this.entryKeys)
      truncate(this.entryHashes)
    }
    this.live = 0
    this.size = 0
  }

  /**
   * `Map`'s walk: `for (const x of s)`, `s.keys()` and `s.values()` are all
   * this one.
   *
   * @internal Called by name by the code the compiler writes for a `Set`,
   *   src/emit-map.ts.
   */
  walkOpen(): void {
    this.walks = this.walks + 1 // a `u32`: no program nests 2^32 walks
  }

  /** @internal Called by name by the code the compiler writes for a `Set`, src/emit-map.ts. */
  walkNext(from: i32): i32 {
    return nextLive(this.entryHashes, from)
  }

  /** @internal Called by name by the code the compiler writes for a `Set`, src/emit-map.ts. */
  walkClose(): void {
    this.walks = this.walks - 1
  }

  /** @internal Called by name by the code the compiler writes for a `Set`, src/emit-map.ts. */
  keyAt(index: i32, none: T): T {
    if (index >= 0 && index < toI32(this.entryKeys.length)) {
      return this.entryKeys[index]
    }
    return none
  }

  /** @internal Called by name by the code the compiler writes for a `Set`, src/emit-map.ts. */
  insertAt(absent: i64, key: T): void {
    const packed = -1 - absent
    this.entryKeys.push(storedKey(key))
    this.entryHashes.push(toU32(packed))
    this.addOne()
    // Every entry takes a bucket, live or dead, until a rebuild, which files
    // the new entry with the rest; otherwise it takes the bucket the probe found.
    if (!fileAppended(this.slots, this.mask, toI32(packed >> 32), this.entryHashes)) {
      this.rebuild()
    }
  }

  /** `Map`'s count of one more live entry. */
  private addOne(): void {
    const live = this.live
    if (live < 2147483647) {
      this.live = live + 1
    }
    const size = this.size
    if (size < 2147483647) {
      this.size = size + 1
    }
  }

  /** `Map`'s count of one live entry fewer. */
  private dropOne(): void {
    const live = this.live
    if (live > 0) {
      this.live = live - 1
    }
    const size = this.size
    if (size > 0) {
      this.size = size - 1
    }
  }

  private rebuild(): void {
    const used = toI32(this.entryKeys.length)
    const walking = this.walks > 0
    const slots = rebuiltSlots(this.slots, walking ? used : this.live, used)
    if (!walking && this.live < used) {
      compactEntries(this.entryKeys, this.entryHashes)
      compactHashes(this.entryHashes)
    }
    this.slots = slots
    this.mask = toI32(slots.length) - 1
    refile(slots, this.entryHashes)
  }

  /**
   * The entry keys, dead ones included, as `Map.walkKeys`.
   *
   * @internal Called by `forEachElement`.
   */
  walkKeys(): T[] {
    return this.entryKeys
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
const storedKey = <K>(key: K): K => key

/**
 * Calls `f` with the value and the key of each entry of `m`, in insertion
 * order: what `m.forEach(f)` compiles to when `f` takes two parameters. It is
 * the walk a `for...of` over `m.keys()` makes, and reads the value from the
 * entry the walk is on, so each entry costs no probe. An entry the callback
 * adds is visited and one it deletes is not, as `Map.prototype.forEach` does.
 * Placed after `storedKey` so that no earlier line moved.
 *
 * @param m the table walked; the callback may change it.
 * @param f called once per live entry, with its value and then its key.
 */
export const forEachEntry = <K, V>(m: Map<K, V>, f: (value: V, key: K) => void): void => {
  m.walkOpen()
  for (let i: i32 = m.walkNext(0); i >= 0; i = i < 2147483647 ? m.walkNext(i + 1) : -1) {
    const keys = m.walkKeys()
    const values = m.walkValues()
    if (i < keys.length && i < values.length) {
      f(values[i], keys[i])
    }
  }
  m.walkClose()
}

/**
 * Calls `f` with the value of each entry of `m`, in insertion order: what
 * `m.forEach(f)` compiles to when `f` takes one parameter. The walk is
 * `forEachEntry`'s.
 *
 * @param m the table walked; the callback may change it.
 * @param f called once per live entry, with its value.
 */
export const forEachValue = <K, V>(m: Map<K, V>, f: (value: V) => void): void => {
  m.walkOpen()
  for (let i: i32 = m.walkNext(0); i >= 0; i = i < 2147483647 ? m.walkNext(i + 1) : -1) {
    const values = m.walkValues()
    if (i < values.length) {
      f(values[i])
    }
  }
  m.walkClose()
}

/**
 * Calls `f` with each element of `s`, in insertion order: what `s.forEach(f)`
 * compiles to. The walk is a `for...of` over `s`, with its rule for elements
 * the callback adds or deletes.
 *
 * @param s the set walked; the callback may change it.
 * @param f called once per live element.
 */
export const forEachElement = <T>(s: Set<T>, f: (value: T) => void): void => {
  s.walkOpen()
  for (let i: i32 = s.walkNext(0); i >= 0; i = i < 2147483647 ? s.walkNext(i + 1) : -1) {
    const keys = s.walkKeys()
    if (i < keys.length) {
      f(keys[i])
    }
  }
  s.walkClose()
}
