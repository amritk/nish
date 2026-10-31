# Maps and sets

`Map<K, V>` stores a value under each key and `Set<T>` keeps each value once.
They behave as JavaScript's do: entries come back in the order they were
inserted, and keys are compared as `===` compares them, except that every
`NaN` is the same key. Both are always available, with no import. The full
rules are in the reference under [`Map` and `Set`](../../LANGUAGE.md#map-and-set).

## Making and filling one

```ts nish:ok
export const main = (): i32 => {
  const ages = new Map<string, i32>();
  ages.set("ada", 36).set("alan", 41).set("grace", 85);
  ages.delete("alan");

  const seen = new Set<string>();
  seen.add("red").add("green").add("red");

  console.log(`${ages.size} people, ${seen.size} colours`);
  console.log(`${ages.has("ada")} ${seen.has("blue")}`);
  return 0;
};
```

This prints `2 people, 2 colours` and then `true false`.

A `Map` has `size`, `get`, `set`, `has`, `delete` and `clear`; a `Set` has
`size`, `add`, `has`, `delete` and `clear`. `set` and `add` return the map or
set, so calls chain, and `delete` returns whether the key was there.

Write the type arguments after `new`, or put them on the declaration and leave
them off `new`: `const counts: Map<string, i32> = new Map()`. A `new Map` or
`new Set` takes no arguments, so there is no `new Set(["a", "b"])`; add the
values one at a time.

**Keys** may be strings, numbers of any width, booleans, enums or class
instances. A class instance is compared by identity, so two objects with the
same fields are two keys. An interface, an array, a nullable type or a `Result`
cannot be a key, because none of them has a value or an identity to hash:

```ts nish:err NL2353
interface Point {
  x: i32;
  y: i32;
}

export const main = (): i32 => {
  const names = new Map<Point, string>();
  return names.size;
};
```

**Values** may be anything except `void` and an interface. To store a record,
make it a class.

### Two numbers as one key

A map keyed by a pair — a grid cell, an edge between two nodes — needs no
string and no class: pack the two `i32`s into one `i64`, the first shifted
into the high half and the second taken unsigned (`toU32`) into the low half. Write every
operand as an `i64`, because under Node an `i64` is a `BigInt`, which will not
mix with a plain number:

```ts nish:ok
const cell = (row: i32, col: i32): i64 => (toI64(row) << toI64(32)) | toI64(toU32(col));

export const main = (): i32 => {
  const grid = new Map<i64, string>();
  grid.set(cell(1, -2), "wall");
  grid.set(cell(-2, 1), "door");
  console.log(`${grid.get(cell(1, -2)) ?? "?"} ${grid.get(cell(-2, 1)) ?? "?"} ${grid.has(cell(0, 0))}`);
  return 0;
};
```

This prints `wall door false`. The key is exact for every pair of `i32`s,
negative ones and the extremes included: taking the low half unsigned keeps it from
reaching the high one, so nothing is added and nothing overflows, and two
different pairs never give the same key. Write `|`, not `+`: `row * 2^32 + col`
leaves the `i64` range at `row = -2^31` with a negative `col`. It is also
cheaper than a string key like `` `${row},${col}` ``, which builds and hashes a
string on every lookup.

## Reading a value: `get`

`m.get(key)` returns `V | undefined`, just as it does in TypeScript: the key
may not be there. Nish lets you use that answer in three ways, the three a
program checked by `tsc --strict` would use:

```ts nish:ok
export const main = (): i32 => {
  const counts = new Map<string, i32>();
  for (const word of ["a", "b", "a"]) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  const a = counts.get("a");
  if (a !== undefined) {
    console.log(`a appears ${a} times`);
  }

  if (counts.get("z") === undefined) {
    console.log("no z");
  }
  return 0;
};
```

This prints `a appears 2 times` and then `no z`.

- **Give it a default with `??`.** `counts.get(word) ?? 0` is the value, or `0`
  when the key is missing.
- **Bind it to a `const` and test it.** After `a !== undefined`, or after an
  early `if (a === undefined) return …`, `a` is a plain `i32`.
- **Compare it with `undefined`** to ask only whether the key is there, though
  `has` says the same thing.

Anywhere else the possibly-missing value is refused, with a message that says
which of the three to use instead: it cannot be stored in a `let`, passed to a
function, returned, or used in arithmetic until it has been given a default or
tested.

```ts nish:err NL2367
export const main = (): i32 => {
  const stock = new Map<string, i32>();
  const n = stock.get("apples");
  console.log(`${n + 1}`);
  return 0;
};
```

The update in the loop above, `counts.set(word, (counts.get(word) ?? 0) + 1)`, looks
the key up once, not twice: the compiler recognises a `set` whose new value
reads the same key with `get` or `has`, and reuses that first lookup. So does
`if (!s.has(x)) { s.add(x); … }`.

A string key, and an integer, boolean or enum key, is hashed under a key the
program draws at random when it starts, so input from outside — the keys of a
JSON body, the words of a file, the ids in a request — cannot be chosen to land
in one bucket and slow every lookup down. A floating-point key is not keyed, so
key a table of outside input by an integer or a string. Nothing you can
observe depends on that key: a map still walks in insertion order, run after
run.

## Walking one

`for...of` walks a map's `keys()` or `values()`, or a set directly, in
insertion order:

```ts nish:ok
export const main = (): i32 => {
  const ages = new Map<string, i32>();
  ages.set("ada", 36).set("grace", 85);

  let total = 0;
  for (const name of ages.keys()) {
    console.log(name);
  }
  for (const age of ages.values()) {
    total += age;
  }
  console.log(`total ${total}`);

  const tags = new Set<string>();
  tags.add("x").add("y");
  for (const tag of tags) {
    console.log(tag);
  }
  return 0;
};
```

This prints `ada`, `grace`, `total 121`, `x` and `y`, one to a line.

There is no `entries()`, because Nish has no destructuring to take a
`[key, value]` pair apart, and no `forEach`, because a method cannot take a
function. Walking a `Map` directly would mean walking its entries, so it is
refused with the rewrite: walk `keys()` and call `get`, or walk `values()`.

```ts nish:err NL2375
export const main = (): i32 => {
  const ages = new Map<string, i32>();
  for (const entry of ages) {
  }
  return 0;
};
```

`keys()` and `values()` can only appear as the thing a `for...of` walks; they
cannot be stored in a variable or passed around.

Changing the table during a walk does what it does in JavaScript: a key added
during the walk is visited later in it, and a key deleted before the walk
reaches it is skipped.

## `nish/map`: two more calls

The standard library's [`nish/map`](../using-nish/standard-library.md) adds
two functions JavaScript's `Map` has no method for. `reserve(m, n)` makes room
for `n` entries up front, so filling the map never has to grow it.
`getOrInsert(m, key, value)` returns the value stored under `key`, inserting
`value` first if the key is missing, with one lookup. Under Node they are
ordinary functions with the same results, so the program still runs there.

```ts nish:ok
import { getOrInsert, reserve } from "nish/map";

export const main = (): i32 => {
  const first = new Map<string, i32>();
  reserve(first, 64);
  const a = getOrInsert(first, "a", 1);
  const b = getOrInsert(first, "a", 2);
  console.log(`${a} ${b} ${first.size}`);
  return 0;
};
```

This prints `1 1 1`: the second call finds `"a"` already there and does not
store `2`.
