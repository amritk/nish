# Compact classes

A class whose objects point at each other, such as a list cell or a tree
node, spends most of its memory on those pointers: each is 8 bytes on a 64-bit
machine. Write `implements Compact` and Nish stores each of those links in 4
bytes instead, so a tree node of an `i32` and two links is 12 bytes rather than
24 and twice as many fit in the cache. The program reads, writes and prints
exactly what it does without the marker. The interface comes from the
built-in module `nish:compact`. The rules are in the reference under
[Compact classes](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#compact-classes).

## Marking a class

Import `Compact` and add it to the class's `implements` clause. Nothing else
in the program changes:

<!-- nish:ok -->
```ts
import { Compact } from "nish:compact";

class Tree implements Compact {
  left: Tree | null = null;
  right: Tree | null = null;
  depth: i32;
  constructor(depth: i32) {
    this.depth = depth;
    if (depth > 0) {
      this.left = new Tree(depth - 1);
      this.right = new Tree(depth - 1);
    }
  }
}

const count = (t: Tree | null): i32 => {
  if (t === null) {
    return 0;
  }
  return 1 + count(t.left) + count(t.right);
};

export const main = (): i32 => {
  console.log(count(new Tree(10)));
  return 0;
};
```

## What gets smaller

Only a *link* shrinks: a field whose type is exactly the compact class, or the
compact class or `null`. That holds in any class, so a plain class with a
`head: Cell | null` field stores it in 4 bytes too. Everything else stays as it
is: a local variable, a parameter, a return value, an array element, a `Map`
key or value, and a field of a wider union type all hold a full pointer.

A compact class whose fields are all 4 bytes or narrower is itself 4-byte
aligned, so a list cell of an `i32` and one link is 8 bytes. A field of
`string`, `f64` or `i64` keeps the class at 8.

On wasm32 a pointer is already 4 bytes, so the marker changes nothing there.
A page module built for the host with `--emit-dts` runs on the wasm runtime,
so it keeps full pointers too, and so does a sanitizer build (`NISH_ASAN`).
Under Node the marker is an empty interface and changes nothing.

## Where a compact class is refused

C and Node read a pointer as 8 bytes, so a compact class may not cross into
their code:

- A build with `--emit-header`, `--emit-napi` or `--emit-napi-async` refuses
  every compact class (NL4021), and an exported function whose signature holds
  one (NL4020).
- A `declare class` describes a C struct, so it cannot implement `Compact`
  (NL2795) or hold a field of a compact class (NL2796).
- A generic class cannot implement `Compact` yet (NL2798): each
  instantiation is laid out for its type argument, and its links would stay
  full pointers. Write the class for the one type it holds instead.
- A compact class holds no `Secret` (NL2797). Keep the secret in a class of
  its own:

<!-- nish:err NL2797 -->
```ts
import { Compact } from "nish:compact";
import { Secret, secret, wipe } from "nish:secret";

class Key implements Compact {
  readonly k: Secret<u8[]>;
  next: Key | null = null;
  constructor(seed: u8) {
    this.k = secret([seed]);
  }
}

export const main = (): i32 => {
  const key = new Key(toU8(1));
  wipe(key.k);
  return 0;
};
```
