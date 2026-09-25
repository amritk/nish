// `StringMap` and `StringSet`: the name lookup every phase of a compiler is
// made of (docs/wp14-selfhost.md §2.2). `src/` reached for `Map` and `Set` at
// about 200 sites, and Nish-0 has neither, so this is library code over the
// arrays and the bitwise operators the language already has.
//
// **Open addressing over a dense entry list**, in the layout WP32 chose for
// the global `Map` (docs/wp32-map.md §2). The entries live in insertion order
// in `keys` / `values`, beside `hashes`, the full 32-bit hash of each key.
// `slots` is a power-of-two bucket table of `u32`s: the key's top eight hash
// bits, the fingerprint, above a 24-bit entry index plus one. 0 is an empty
// bucket. What that shape buys:
//
//   - Iteration is insertion order, so a dump built by walking a scope is
//     deterministic. Golden-compared diagnostics need that; a hash order
//     would make the output depend on the table size.
//   - There is no empty-key sentinel to get wrong. `""` is a perfectly good
//     key, which a table storing keys in the buckets has to special-case.
//   - A probe reads the entry list only when a bucket's fingerprint matches,
//     one foreign bucket in 256, and then compares the stored hash before the
//     string, so a miss almost never touches a key.
//   - Growth re-files the buckets from `hashes` and never hashes a key again.
//
// There is no `delete`. Nothing in a compiler removes a name from a scope —
// scopes are popped whole — so the note's tombstone, its dead-entry hash of 0
// and the compaction that clears the buckets in place (§6.1) have nothing to
// do here: every rebuild is a doubling, and a hash of 0 is an ordinary hash.

/**
 * FNV-1a over the bytes of `key`. The round is a multiply that is *supposed*
 * to overflow, so it is done in `u32`, whose arithmetic is defined as wrapping
 * whatever `--wrapping` says; on a signed accumulator the same multiply would
 * be undefined under the default `nsw` (WP15 §3).
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

/**
 * A set of strings, over the same table. Composition rather than a second
 * open-addressing loop, so there is exactly one probe in this file to get
 * wrong.
 */
export class StringSet {
  map: StringMap;

  constructor() {
    this.map = new StringMap();
  }

  size(): i32 {
    return this.map.size();
  }

  at(index: i32): string {
    return this.map.keyAt(index);
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  /** Add `key`; true when it was not already there. One probe either way. */
  add(key: string): boolean {
    return this.map.add(key, 0);
  }
}
