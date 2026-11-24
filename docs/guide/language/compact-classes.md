# Compact classes

A class whose objects point at each other, such as a list cell or a tree
node, spends most of its memory on those pointers: each is 8 bytes on a 64-bit
machine. Write `implements Compact` and Nish stores each of those links in 4
bytes instead, so a tree node of an `i32` and two links is 12 bytes rather than
24 and twice as many fit in the cache. The program reads, writes and prints
exactly what it does without the marker. The interface comes from the
built-in module `nish:compact`. The rules are in the reference under
[Compact classes](../../reference/language/builtins.md#compact-classes).

## Marking a class

Several examples on this page do `i32` arithmetic nothing bounds, so the
compiler cannot prove it fits and they build with
[`--allow-panics`](../using-nish/cli.md#asking-what-a-program-can-do); bounding the operands,
as the compile error suggests, builds them under the default.

Import `Compact` and add it to the class's `implements` clause. Nothing else
in the program changes:

<!-- allow-panics: does integer arithmetic nothing bounds -->
<!-- nish:ok --allow-panics -->
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

## Classes the compiler picks for you

A native build (`--link`, or `nish run`) compacts a class without the marker
when doing so pays: something links to the class, the class is at least 24
bytes, narrowing those links takes at least a quarter off its size, and the
program makes the class in a loop or a recursive function. The `Tree` above qualifies with
the marker removed: its two links take it from 24 bytes to 12. A saving
smaller than a quarter is left alone, because every read of a compact link
pays a widening back to a pointer. So is a class of 16 bytes or less, such as
a list cell of an `i32` and one link: four already fit in a cache line, and
narrowed it measured slower. A saving only in some other class that holds the
link is left alone too. Write `implements Compact` if you want one of these.

To see what was picked, and why each other class was not, add
`--explain-layout`:

```
nish run --explain-layout tree.ts
```

It prints one line per class: `compact` with its size before and after, or
the first test that refused it. IR alone (`-o` with no `--link`) and wasm32
builds pick nothing.

## Keeping a class wide

To keep one class's links full pointers, write `implements Wide`. Without
the marker, this 24-byte `Peer` would be picked and narrowed to 12:

<!-- nish:ok -->
```ts
import { Wide } from "nish:compact";

class Peer implements Wide {
  next: Peer | null = null;
  prev: Peer | null = null;
  id: i32;
  constructor(id: i32) {
    this.id = id;
  }
}

export const main = (): i32 => {
  let head: Peer | null = null;
  for (let i = 0; i < 4; i++) {
    const p = new Peer(i);
    p.next = head;
    head = p;
  }
  console.log(head === null ? -1 : head.id);
  return 0;
};
```

`--compact off` does the same for every class in the build, those marked
`implements Compact` included. A class may not write both `Compact` and
`Wide` (NL2819).

## When to override the rule

The rule's choices come from timing programs both ways, and it is right for
most programs. Two cases can go the other way:

- **A picked class in a small, hot graph.** A compact link costs one more
  instruction on every read, and a loop where each read's address is the last
  read's result pays it on every hop. On a sibling-linked tree of 400,000
  nodes, small enough to fit in the cache, a climb from every leaf to the
  root ran 15% slower with 32-bit links. The whole program, whose other
  passes gain from the smaller nodes, came out level. If your graph is that small and that
  loop is most of the time, measure with `--compact off` and, if it wins,
  write `implements Wide` on the class.
- **A refused class you have measured.** A class under 24 bytes is refused
  because narrowing measured slower: a 16-byte binary-trees node ran 19%
  slower compact, though it took half the memory. Write `implements Compact`
  only when memory matters more than that time, or when your own timing
  shows a gain.

Large graphs touched once, such as a tree built and then walked, are where
the rule pays most: a 33-million-node tree of 24-byte nodes took half the
peak memory and two thirds of the time with the rule on.

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

<!-- allow-panics: does integer arithmetic nothing bounds -->
<!-- nish:ok --allow-panics -->
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
    `--no-strict-exports`), and at each constructor and method of an
    exported class, whose signature holds a compact class. The signature is
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

## Debugging a compact class

A link is stored as a 4-byte offset, so a debugger on its own prints it as a
number. A `-g` build names the type of each link `ref32 <Class>`, and the
repository ships a printer for each debugger that shows the link as the
object it names instead: `null` for an empty link, else a pointer to the
object, whose fields you can expand. The printers are not in the npm
package: they live in the repository's
[`tools/`](https://github.com/amritk/nish/tree/main/tools) directory, so run
the commands below from a checkout of the repository, or give the path to
your copy of each file. Build with debug info:

```sh
nish list.ts -g --link list --profile debug
```

In gdb, load `tools/gdb/ref32.py` (or put the line in `~/.gdbinit`):

```text
(gdb) source tools/gdb/ref32.py
(gdb) print *head
$1 = {value = 4, next = (struct Cell *) 0x40000068}
(gdb) print $ref32(head->next)->value
$2 = 3
```

`print *head` shows `next` as a pointer, and `$ref32(link)` turns a link
into one you can follow.

In lldb, import `tools/lldb/ref32.py`:

```text
(lldb) command script import tools/lldb/ref32.py
(lldb) frame variable head->next
(ref32 Cell) head->next = 268435482 (Cell *) 0x40000068
(lldb) frame variable head->next.value
(int) head->next.value = 3
```

lldb shows the stored offset and the pointer it names, and the link's fields
are its children, so `head->next.next` walks one link further.

How an offset turns into an address depends on the target the program was
built for: on Linux it is the offset times four, and on macOS it is counted
from the runtime's `nish_ref_base`. Each printer picks the decode from the
program it is debugging. To force one, run `set nish-ref32-shape zero` or
`based` in gdb, or start lldb with `NISH_REF32_SHAPE=zero` or `based` in its
environment.
