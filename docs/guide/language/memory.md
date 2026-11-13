# Memory

Nish has no garbage collector, and outside a region nothing to `free`. The
compiler decides where every object, array and string lives, and when its
memory is reused, while it compiles the program; at run time there is nothing
scanning for garbage and, unless you make a [region](regions.md), nothing for
you to release. Most programs never need to think about memory at
all. This page says why, and what the exceptions are. The reference sections
are [Memory model](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#memory-model) and
[`using a = arena()`](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#using-a--arena).

## What the compiler does for you

Every allocation goes to one of two places:

- **The stack**, when the compiler can prove the value does not outlive the
  function that made it: an object that is only read, an array literal that
  is only looped over. This costs nothing to free.
- **The arena**, a large block the program allocates from by bumping a
  pointer, for everything else. Allocating there is a few instructions.

Memory in the arena is handed back in bulk rather than one value at a time.
A function whose temporaries all die with it marks the arena when it starts
and rewinds to the mark when it returns. A loop whose passes allocate
temporaries does the same on every pass. The compiler adds these brackets
wherever it can prove that nothing allocated inside them is still reachable
afterwards, and whatever is left in the arena is released when `main`
returns.

```ts nish:ok
const describe = (name: string, score: i32): i32 => {
  const line = `${name} scored ${score}`;
  return line.length;
};

export const main = (): i32 => {
  let total = 0;
  for (let i = 0; i < 100000; i++) {
    total = total + describe("ada", i % 100);
  }
  console.log(`${total}`);
  return 0;
};
```

This prints `1290000`. It builds 100,000 strings, but each one dies with its
call to `describe`, so the program reuses the same few bytes of arena
throughout.

A `Result` held in a `let` that you assign again does not cost a function its
bracket. The `Ok` and the `Err` below live on `pick`'s stack frame, so calling
it in a loop leaves the arena where it was:

```ts nish:ok
const pick = (n: i32): i32 => {
  let r: Result<i32, string> = Ok(n);
  if (n % 3 === 0 && r.isOk()) {
    r = Err("three");
  }
  return r.unwrapOr(-1);
};

export const main = (): i32 => {
  const before = Arena.used();
  let total = 0;
  for (let i = 0; i < 100000; i++) {
    total = total + pick(i % 10);
  }
  const flat = Arena.used() === before;
  console.log(`${total} ${flat}`);
  return 0;
};
```

This prints `230000 true`. A `let` assigned from itself, such as
`r = n > 5 ? r : Ok(0)`, is the exception: its values stay in the arena.

None of this changes what a program computes, only where its memory lives
and when it is reused. Unlike in C or Rust:

- you never free anything but a [region](regions.md), and freeing one twice
  stops the program with a message rather than corrupting memory;
- a value you can still reach is never released under you;
- there are no lifetimes or ownership annotations to write.

## What you do have to think about

The arena only rewinds where the compiler can prove nothing is lost. A
program that runs briefly and exits can ignore this. A program that runs for
a long time, a server or a long batch job, has to watch for one pattern:
**memory that nothing can reach but nothing frees until the end of the
program**. The compiler finds the common shapes of it and warns:

```ts
let last = "";
for (let i = 0; i < 1000000; i++) {
  last = `item ${i}`;   // warning: memory grows with every pass
}
```

Each pass gives `last` a new string and drops the old one, and the dropped
strings stay allocated until `main` returns. The warning (NL9016) says what to
do instead: declare the value with `const` inside the loop if only that pass
needs it, or keep numbers across passes and build the string once after the
loop. Building a string up with `s = s + t` in a loop is the same problem and
has its own warning.

A function a loop calls on every pass can keep memory the same way. When a
function assigns a `let` a second string, as `relabel` does below, the
compiler cannot prove the first one dead when it returns, so the function
keeps what it allocated on every call:

```ts
const relabel = (n: i32): i32 => {   // warning: keeps an allocation on every call
  let s = "none";
  if (n > 2) {
    s = `b${n}`;
  }
  return s.length;
};

const names: string[] = [];
for (let i = 0; i < 1000000; i++) {
  names.push(`${relabel(i)}`);
}
```

The warning (NL9018) names the function and the line it keeps. Give each
value its own `const` (``const s = n > 2 ? `b${n}` : "none"``), or open a
block with `using a = arena()` around the work. A loop whose passes are
released already, because nothing a pass makes outlives it, takes back what
the call kept, so that one does not warn.

For a program that must not retain memory this way, compile with
`--deny-retention`, which turns these warnings into errors:

```ts nish:err-body NL2462 --deny-retention
let last = "";
for (let i = 0; i < 1000; i++) {
  last = `item ${i}`;
}
console.log(last);
```

The warnings catch the shapes the compiler can name, not every possible
leak: an array you keep pushing onto for the whole run is memory you meant
to keep, and nothing warns about it.

To see every loop and function that keeps its memory, whether or not a warning
names it, compile with `--explain-memory`. It prints one line for each loop
whose passes keep what they allocate, and for each function that keeps memory
after it returns, with the reason and where the memory is finally released:

```
app.ts:12:3: memory: this loop keeps what each pass allocates until `main` returns, because line 13 grows `seen`, an array older than the pass
explain-memory: 1 of 4 allocating loops keep what a pass allocates past the pass; 0 of 2 allocating functions with a scalar result keep what they allocate past the call
```

Read it before you deploy a long-running program: a loop listed here
allocates on every pass and gives nothing back until the line says it does.
The flag does not change the program it builds. The rules are in
[Explaining kept memory](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#explaining-kept-memory).

### A tree links its children, not an array of them

A program that builds a large tree, such as a parser's syntax tree, should
give each node a link to its first child and one to its next sibling, rather
than a `kids: Node[]` array. Every array is a header and a separate block of
memory, and an array that grows by `push` leaves the blocks it outgrew in the
arena until they are released; a walk over the children then follows two
pointers for each child where a sibling link follows one. On a tree of four
million nodes, the linked layout took **0.52x the memory and 0.68x the time**
of an array per node.

```ts nish:ok
class Node {
  kind: i32;
  parent: Node | null;
  first: Node | null = null;
  next: Node | null = null;

  constructor(kind: i32, parent: Node | null) {
    this.kind = kind;
    this.parent = parent;
  }
}

// `last` is the parent's last child so far, or null before the first.
const add = (parent: Node, last: Node | null, kind: i32): Node => {
  const kid = new Node(kind, parent);
  if (last === null) {
    parent.first = kid;
  } else {
    last.next = kid;
  }
  return kid;
};

const sum = (n: Node): i32 => {
  let s = n.kind;
  let kid = n.first;
  while (kid !== null) {
    s = s + sum(kid);
    kid = kid.next;
  }
  return s;
};

export const main = (): i32 => {
  const root = new Node(1, null);
  const a = add(root, null, 2);
  add(root, a, 3);
  add(a, null, 4);
  console.log(`${sum(root)}`);
  return 0;
};
```

This prints `10`. A child is added after the parent's last one, so the
children stay in the order they were made, and the walk reads them in that
order.

Where some pass needs to reach a node's children by index, keep a count of
them on the node, and fill its `Node[]` once, when the node is complete,
rather than pushing to it as each child arrives.

A large table that a hot loop reads and that has a fixed set of fields, such
as a scanner's tokens or a table of types, can go further: one `i32[]` per
field, each made at its final length with `new Array<i32>(n)`, and a row
referred to by its index, with `-1` for none. On the same tree that took
**0.32x the memory and 0.63x the time** of an array per node. Every read is
then an index into a column, which is harder to follow than a field, so keep
it to the tables that are hot. `uncheckedGet` and `uncheckedSet` from
`nish:unsafe` skip the bounds check there; an index out of range is then
undefined behaviour rather than a stopped program, so they belong in that
table's code and nowhere else. The programs and the full measurements are in
[the benchmark](https://github.com/amritk/nish/tree/main/bench/wp48-refs).

<a id="freeing-a-batch-yourself-using-a--arena" style="scroll-margin-top: 65px"></a>

## Freeing a batch yourself: `using a = arena()`

When you know a block's allocations are temporary, say so with
`using a = arena()`. Everything the block allocates after that line is
released when the block ends, on every way out of it: the closing brace, a
`return`, a `break` or a `continue`.

```ts nish:ok
const checksum = (lines: string[]): i32 => {
  let total = 0;
  for (const line of lines) {
    using a = arena();
    const tagged = `${line}:${line.length}`;
    total = total + tagged.length;
  }
  return total;
};

export const main = (): i32 => {
  console.log(`${checksum(["alpha", "beta", "gamma"])}`);
  return 0;
};
```

This prints `20`. Numbers, booleans and enums may leave the block freely,
which is how `total` is carried out of it.

The compiler checks the block: if anything allocated inside it could still be
reachable after the release, the program does not compile. Assigning a string
built in the block to a variable declared outside it, storing it in an object
or array that outlives the block, or returning it, are all refused:

```ts nish:err-body NL2418
const rows = ["a", "bb", "ccc"];
let longest = "";
for (const row of rows) {
  using a = arena();
  const line = `${row}!`;
  if (line.length > longest.length) {
    longest = line;
  }
}
console.log(longest);
```

What has to outlive the block is allocated before the block opens. The check
is cautious, so it also refuses some blocks that would in fact be safe, such
as one that builds a `Map`; when it does, move that work out of the block.
A `parallelMap`, `parallelFrom` or `parallelMapInto` from `nish/threads` may
run inside the block when its body answers numbers or strings, and its result
is released with the block, so a string it answers may not leave the block
either; one whose body answers arrays is refused, and the error says to run
it outside the block.

`arena()` is only ever the initialiser of a `using` declaration, and `a` is
never read: it exists so that the block has something to release when it
ends. Under Node, where the program runs as plain TypeScript, it does nothing.

`Arena.release` and `Arena.reset`, the older way to do this, released memory
without checking that nothing still pointed into it. They were removed before
1.0, and a call to either is now an unknown builtin: write `using a = arena()`
instead.

Memory that has to outlive one block but not the program, such as the state a
server keeps per connection, goes in a region you free yourself:
[Regions](regions.md).
