# Memory

Nish has no garbage collector and no `free`. The compiler decides where every
object, array and string lives, and when its memory is reused, while it
compiles the program; at run time there is nothing scanning for garbage and
nothing for you to release. Most programs never need to think about memory at
all. This page says why, and what the exceptions are. The reference sections
are [Memory model](../../LANGUAGE.md#memory-model) and
[`using a = arena()`](../../LANGUAGE.md#using-a--arena).

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

None of this changes what a program computes, only where its memory lives
and when it is reused. So, unlike in C:

- you never free anything, and so never free something twice;
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

`arena()` is only ever the initialiser of a `using` declaration, and `a` is
never read: it exists so that the block has something to release when it
ends. Under Node, where the program runs as plain TypeScript, it does nothing.

`Arena.release` and `Arena.reset`, the older way to do this, are deprecated:
they release memory without checking that nothing still points into it, and
each call compiles with a warning (NL7001) pointing to `using a = arena()`.
