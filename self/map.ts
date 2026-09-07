// `StringMap` and `StringSet`: the name lookup every phase of a compiler is
// made of (docs/wp14-selfhost.md §2.2). `src/` reaches for `Map` and `Set` at
// about 200 sites; StaticTS has neither, and adding one would drag in
// generics, which is a work package of its own and is not on the path. So
// this is library code over the arrays and the bitwise operators the language
// already has.
//
// **Open addressing over a dense entry list.** `slots` is a power-of-two
// bucket table holding *entry indices plus one* (0 meaning empty), and the
// entries themselves live in insertion order in `keys` / `values`. Two things
// fall out of that shape and both matter here:
//
//   - Iteration is insertion order, so a dump built by walking a scope is
//     deterministic. Golden-compared diagnostics need that; a hash order
//     would make the output depend on the table size.
//   - There is no empty-key sentinel to get wrong. `""` is a perfectly good
//     key, which a table storing keys in the buckets has to special-case.
//
// There is no `delete`. Nothing in a compiler removes a name from a scope —
// scopes are popped whole — and leaving it out keeps the probe loop free of
// tombstones.

/** FNV-1a over the bytes of `key`, as an i32 with the usual wrapping multiply. */
export function hashString(key: string): i32 {
  let hash = -2128831035; // 2166136261, read as a signed i32
  let i = 0;
  while (i < key.length) {
    hash = hash ^ key.charCodeAt(i);
    hash = hash * 16777619;
    i = i + 1;
  }
  return hash;
}

/** The initial bucket count. Small: most scopes hold a handful of names. */
const INITIAL_SLOTS: i32 = 16;

export class StringMap {
  /** Bucket -> index into `keys` / `values`, plus one. 0 is an empty bucket. */
  slots: i32[];
  /** `slots.length - 1`; the length is always a power of two. */
  mask: i32;
  /** The entries, in insertion order. */
  keys: string[];
  values: i32[];

  constructor() {
    this.slots = new Array<i32>(INITIAL_SLOTS);
    this.mask = INITIAL_SLOTS - 1;
    this.keys = [];
    this.values = [];
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
   * The bucket `key` occupies or would occupy: linear probing from its hash,
   * stopping at the first empty bucket or the bucket already holding `key`.
   * The load factor below keeps at least a quarter of the buckets empty, so
   * this always terminates.
   */
  probe(key: string, hash: i32): i32 {
    let bucket = (hash ^ (hash >>> 16)) & this.mask;
    while (this.slots[bucket] !== 0) {
      if (this.keys[this.slots[bucket] - 1] === key) {
        return bucket;
      }
      bucket = (bucket + 1) & this.mask;
    }
    return bucket;
  }

  /** The entry index for `key`, or -1 when the map does not hold it. */
  find(key: string): i32 {
    return this.slots[this.probe(key, hashString(key))] - 1;
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
    const index = this.find(key);
    return index < 0 ? missing : this.values[index];
  }

  /** Insert `key`, or overwrite the value it already has. */
  set(key: string, value: i32): void {
    const bucket = this.probe(key, hashString(key));
    const slot = this.slots[bucket];
    if (slot !== 0) {
      this.values[slot - 1] = value;
      return;
    }
    this.keys.push(key);
    this.values.push(value);
    this.slots[bucket] = this.keys.length;
    // Grow at three quarters full, before the probe chains get long.
    if (this.keys.length * 4 > this.slots.length * 3) {
      this.grow();
    }
  }

  /**
   * Double the bucket table and re-file every entry. The entries do not move,
   * so insertion order — and every index a caller is holding — survives.
   */
  grow(): void {
    const wider = this.slots.length * 2;
    this.slots = new Array<i32>(wider);
    this.mask = wider - 1;
    let i = 0;
    while (i < this.keys.length) {
      const hash = hashString(this.keys[i]);
      let bucket = (hash ^ (hash >>> 16)) & this.mask;
      while (this.slots[bucket] !== 0) {
        bucket = (bucket + 1) & this.mask;
      }
      this.slots[bucket] = i + 1;
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

  /** Add `key`; true when it was not already there. */
  add(key: string): boolean {
    if (this.map.has(key)) {
      return false;
    }
    this.map.set(key, 0);
    return true;
  }
}
