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

## A compact class in a C host

A `--emit-header` build keeps every class that holds a link opaque, because C
would read a 32-bit link as an 8-byte pointer. That covers the compact class
itself, a class with a field of it, and an instantiation such as `Box<Cell>`.
C holds an instance as a handle, passes it back to an exported function, and
never reads its fields:

<!-- nish:ok -->
```ts
import { Compact } from "nish:compact";

export class Cell implements Compact {
  value: i32;
  next: Cell | null;
  constructor(value: i32, next: Cell | null) {
    this.value = value;
    this.next = next;
  }
}

export const push = (value: i32, head: Cell | null): Cell => new Cell(value, head);

export const total = (head: Cell | null): i32 => {
  let sum = 0;
  let at = head;
  while (at !== null) {
    sum = sum + at.value;
    at = at.next;
  }
  return sum;
};
```

The header declares `typedef struct Cell Cell;` and
`struct Cell *push(int32_t value, struct Cell *head);`, so the host keeps a
`Cell *` and calls back in:

```c
#include <stdio.h>
#include "cells.h"

int main(void) {
  struct Cell *head = NULL;
  for (int32_t i = 1; i <= 4; i++) head = push(i, head);
  printf("%d\n", total(head)); /* 10 */
  return 0;
}
```

Build the runtime with `--arena-range`, the runtime that reserves the range
the links count from. `$NISH` is the directory that holds `scripts/build.sh`
and `runtime/`, as on [Calling Nish from other languages](../using-nish/interop.md):

```sh
nish cells.ts -o cells.ll --emit-header cells.h
$NISH/scripts/build.sh --arena-range cells.ll $NISH/runtime/runtime.c host.c -o host -I$NISH/runtime
```

Without `--arena-range` the link fails on `nish_arena_range_abi`, rather than
running with links that point nowhere. On Linux the range sits at a fixed
address: if something else already holds it, the program stops at start-up
with the range runtime's panic. On macOS the system places the range.

Linking a header build into a shared library that another process loads is
not supported: Nish would reserve its range inside a process it does not own.

## Where a compact class is refused

Node reads a pointer as 8 bytes and runs an addon in its own process, so a
compact class may not cross into it:

- A build with `--emit-napi` or `--emit-napi-async` refuses a compact class
  in one of two places, each with its own code:
  - NL4020, at the name of each exported function (every function, under
    `--no-strict-exports`), and at the constructor of each exported class,
    whose signature holds a compact class. The signature is
    read return type first, then each parameter in order, and the message
    names the first compact class found. Change the signature to fix it.
  - NL4021, at the name of each compact class no NL4020 named, naming the
    flag. Build a C host with `--emit-header` instead, or drop the marker.

  Adding `--emit-header` beside either flag lifts neither refusal.
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
