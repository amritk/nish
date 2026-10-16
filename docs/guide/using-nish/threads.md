# Threads

Nish runs code on several threads without letting two threads race on the
same memory. It does that by offering a few shapes of parallel work, each
with rules the compiler checks, instead of raw threads and shared variables:

- **`parallelMapInto`, `parallelMap`, `parallelFrom` and `parallelReduce`** —
  one function over every element of an array, or every index of a new one.
- **`scope()`** — a handful of different tasks at once, joined when a block
  ends.
- **`Mutex<T>`** — one value that a scope's tasks all update.
- **`AtomicI32` and `AtomicI64`** — one counter that tasks, or a parallel
  map's function, update without a lock.
- **`Channel<T>`** — numbers passed from tasks that produce them to one that
  consumes them.

All of them come from `nish/threads`. Importing it is the only switch: the
program is built for threads, and there is no thread count to choose. A
program that breaks one of the rules below is refused at compile time, with a
message that names the line and the reason; the rules are what keep threads
from racing on memory or deadlocking on a lock or a channel.

The same program also runs under Node, one task at a time, and prints the same
answer ([RUN_UNDER_NODE.md](../../RUN_UNDER_NODE.md) says how).

## One function over an array: `parallelMapInto` and `parallelReduce`

`parallelMapInto(src, dst, f)` writes `f(src[i])` into `dst[i]` for every
index. `parallelReduce(src, f, identity)` folds the array with `f`. Each
splits the array across as many threads as the machine has and the length is
worth. `f` is a top-level function named at the call, or an arrow written
there.

```ts nish:ok
import { parallelMapInto, parallelReduce } from "nish/threads";

const square = (x: f64): f64 => x * x;

export const main = (): i32 => {
  const n: i32 = 3000000;
  const src = new Array<f64>(n);
  for (let i: i32 = 0; i < src.length; i++) {
    src[i] = toF64(i % 10);
  }
  const dst = new Array<f64>(n);
  parallelMapInto(src, dst, square);
  const total = parallelReduce(dst, (a, b) => a + b, 0.0);
  console.log(`${total}`); // 85500000
  return 0;
};
```

- **A short array is just a loop.** The work is split only when every thread's
  share is big enough to pay for handing it to another thread, judged from
  what `f` costs, so there is no reason to guard a call by size.
- **`dst` must be at least as long as `src`**, or the call panics before it
  writes anything. `src` and `dst` may be the same array.
- **`f` writes nothing its caller can see** — no store through its argument,
  and no output: not `console.log`, `console.error`, `write`, `writeError` or
  `process.exit` — and **answers a number, a `boolean` or an enum**. It may
  look keys up in a `Map` or `Set` its element reaches (`get`, `has`, `size`),
  and it may `panic`: if several elements panic at once, only the first
  prints its message, and the program exits 1. It may
  build strings and arrays on the way to its answer; they are freed after each
  element, and the compiler warns that each element pays for that. An array it
  makes itself, keeps in a `const` and hands to nothing that keeps it is its
  own: it may fill it, `push` onto it, or pass it to a helper that writes it.
- **A reduce is deterministic.** The array is folded in fixed blocks and the
  blocks are combined in order, so an `f64` sum is the same bits on one core or
  sixty-four. For that to be the fold you meant, `f` must be associative and
  `identity` its identity: `(a, b) => a - b`, or `+` with an identity of `1`,
  is refused.

```ts nish:err NL2345
import { parallelMapInto } from "nish/threads";

const noisy = (x: i32): i32 => {
  console.log(`${x}`); // a write every thread would make at once
  return x * 2;
};

export const main = (): i32 => {
  const src: i32[] = [1, 2, 3];
  const dst: i32[] = [0, 0, 0];
  parallelMapInto(src, dst, noisy);
  return dst[0];
};
```

## A new array: `parallelMap` and `parallelFrom`

`parallelMap(src, f)` answers a new array of `f(src[i])`, and
`parallelFrom(n, f)` a new array of `n` elements with `f(i)` at index `i`, the
way `Array.from({ length: n }, (_, i) => f(i))` builds one. Each allocates the
array before it starts and then runs exactly the map above, under the same
rules for `f`. There is no `dst` to get wrong.

```ts nish:ok
import { parallelFrom, parallelMap } from "nish/threads";

export const main = (): i32 => {
  const squares = parallelFrom(5, (i) => i * i);       // 0 1 4 9 16
  const shifted = parallelMap(squares, (x) => x + 1);  // 1 2 5 10 17
  console.log(`${squares[4]} ${shifted[4]}`); // 16 17
  return 0;
};
```

## Reading the function's constants

An arrow passed to one of these four forms may read the `const` locals and the
parameters of the function it is written in, which is how a scale, an offset
or a lookup table reaches the body:

```ts nish:ok
import { parallelMap } from "nish/threads";

const affine = (xs: i32[], k: i32): i32[] => {
  const b: i32 = 1;
  const table: i32[] = [0, 100, 200];
  return parallelMap(xs, (x) => x * k + b + table[x % 3]);
};

export const main = (): i32 => {
  const ys = affine([1, 2, 3], 10);
  console.log(`${ys[0]} ${ys[1]} ${ys[2]}`); // 111 221 31
  return 0;
};
```

- **What the body reads, it only reads.** Every thread sees the same values, so
  the body may not assign to one, store into an array or an object it reads
  this way, or hand one to a function that does. Each of those is refused at
  the call.
- **Only a `const` or a parameter.** A `let` could change while the threads
  read it: bind its value to a `const` first. `this` is not read by that name
  either; bind it, or the field you need, to a `const` (`const self = this`,
  `const k = this.k`).
- **Only the arrow written at the call.** An arrow inside that arrow reads
  nothing from outside itself, and an arrow given to any other function still
  reads only its own parameters. An arrow given to `spawn` reads them too, as
  the next section shows.
- **Not `dst`.** In `parallelMapInto`, a body may not read an array that could
  be the one being written. A `const` table bound to its own array is fine
  beside a `dst` that is a `const` bound to its own array, as in
  `const table = [1, 2]` and `const dst = new Array<i32>(n)`.

```ts nish:err NL2503
import { parallelMap } from "nish/threads";

export const main = (): i32 => {
  const total: i32 = 0;
  const ys = parallelMap([1, 2, 3], (x): i32 => {
    total = total + x; // every thread would write it at once
    return x;
  });
  return ys[0];
};
```

## Different tasks at once: `using s = scope()`

A scope runs different functions side by side, each on a thread. Open it with
`using`, hand it tasks with `s.spawn(entry, arg, dst, at)`, and when the block
ends every task has run and `entry(arg)` is stored in `dst[at]`:

```ts nish:ok
import { scope } from "nish/threads";

const sumOf = (xs: f64[]): f64 => {
  let total: f64 = 0.0;
  for (const x of xs) {
    total = total + x;
  }
  return total;
};

const countPrimes = (limit: i32): i32 => {
  let count = 0;
  for (let n: i32 = 2; n < limit; n++) {
    let prime = true;
    for (let d: i32 = 2; d * d <= n; d++) {
      if (n % d === 0) {
        prime = false;
        break;
      }
    }
    if (prime) {
      count++;
    }
  }
  return count;
};

export const main = (): i32 => {
  const xs: f64[] = [1.5, 2.5, 3.0];
  const sums: f64[] = [0.0];
  const primes: i32[] = [0];
  {
    using s = scope();
    s.spawn(sumOf, xs, sums, 0);           // sums[0] = sumOf(xs)
    s.spawn(countPrimes, 1000, primes, 0); // primes[0] = countPrimes(1000)
  }                                        // both tasks have run here
  console.log(`${sums[0]} ${primes[0]}`);  // 7 168
  return 0;
};
```

- **The tasks run when the block ends**, all together, and their answers are
  stored after the last one finishes. That happens at every way out of the
  block — its end, a `return`, a `break` — so no task is ever left running.
- **Read the answers after the block.** A destination is a `const` bound to a
  fresh array (`[0]`, `new Array<i32>(n)`) that you only index; never pass it
  on. Inside the block, don't read a destination, and don't write memory a
  task could read — through a constructor either: `new Bump(counter)` whose
  constructor writes `counter` is refused like a call that does. Don't call a
  `Map` or `Set` method that changes or walks the table either, even on one
  no task can reach or one you made in the block: the compiler judges the
  call, not which tables the tasks hold. Do it before the first `spawn`,
  after the block, or in a helper that makes and fills its own table. An object
  you make in the block is yours to write, until anything a task reads may
  have got into it: stored in a field or an element, pushed, added to a `Map`
  or a `Set`, put in a literal, or handed to a function that keeps it. A field
  or an element of it counts as much as the object itself. So a `Map`, a
  `Set` or an array you make there is yours to fill and walk, and what you
  read back out of it is yours to write when you put it there fresh.
- **A task follows the rules of a parallel `f` above:** it writes nothing
  another thread can see (except through a `Mutex` or a `Channel`, below) and
  prints nothing (`console.log`, `console.error`, `write`, `writeError` and
  `process.exit` are all refused), answers a number, a `boolean` or an enum
  when it has a destination, and opens no scope of its own. Looking a key up
  in a shared `Map` or `Set` (`get`, `has`, `size`) is a read, so tasks may
  share a table that way; changing it, or walking it with `for...of`, is a
  write. A task may `panic`: if several threads panic at once, only the first
  prints its message, and the program exits 1.
- **A scope never leaves its block.** It is only ever the receiver of
  `spawn`: passing, storing or returning it is refused, and so is a scope
  bound without `using`.

### Tasks without a destination, and arrow tasks

A task that only updates something shared has no answer to store, so it needs
no destination: `s.spawn(entry, arg)` runs `entry(arg)`, and
`s.spawn(() => work(a, b))` runs an arrow that reads the `const` locals and
the parameters of the function it is written in. Either one answers `void`.

```ts nish:ok
import { Mutex, scope } from "nish/threads";

class Tally {
  total: i32 = 0;
}

const addAll = (tally: Mutex<Tally>, xs: i32[]): void => {
  let t: i32 = 0;
  for (const x of xs) {
    t = t + x;
  }
  using g = tally.lock();
  g.value.total = g.value.total + t;
};

export const main = (): i32 => {
  const tally = new Mutex<Tally>(new Tally());
  const low: i32[] = [1, 2, 3];
  const high: i32[] = [40, 50];
  {
    using s = scope();
    s.spawn(() => addAll(tally, low));
    s.spawn(() => addAll(tally, high));
  }
  using g = tally.lock();
  console.log(`${g.value.total}`); // 96
  return 0;
};
```

- **What the arrow reads is the task's argument.** It is handed to the task
  when you spawn it, and the task reads it when the block ends, so every rule
  above holds of it: inside the block, don't write `low` or anything it
  reaches, by any name, through any function or constructor. A `let` is not
  read this way, since it could change before the task runs, and neither is
  `this`: bind them to a `const` first.
- **A lock, yes; a guard or a channel, no.** An arrow task may read a `Mutex`
  and lock it, as `addAll` does. Hand a channel to a task as its argument,
  `s.spawn(produce, new Pipe(ch, 10))`, so the scope can count its senders.
- **No destination, no answer.** An entry that answers a value with no
  destination to store it in is refused; give it one with the four-argument
  form, or make it answer `void`. The arrow's thread is named after the
  function it is written in, so a debugger still shows where it came from.

```ts nish:err NL2506
import { scope } from "nish/threads";

export const main = (): i32 => {
  let k: i32 = 3; // a `let` could change before the task runs
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn((n: i32): i32 => n + k, 1, out, 0);
  }
  return out[0];
};
```

### Where the work runs

The first task runs on the thread that opened the scope, which would otherwise
wait, and the others go to a pool of worker threads, one per core besides the
calling thread's (at most 63), started the first time a program divides work
and parked between uses. A Node addon starts threads for each call instead,
and on WASI everything runs on the one thread. A scope with more tasks than
cores queues the rest, and a thread that finishes one takes the next. The core count follows what the process may actually use (its affinity
mask, a container's CPU quota), and `NISH_NUM_THREADS=2` lowers it to two,
which is handy on a shared machine; `NISH_NUM_THREADS=1` runs everything on
the calling thread. It never raises the count. A map's or a reduce's answer
is the same at any count; what a scope's tasks do under a lock can come out
in a different order, as the lock section below says.

## Sharing a value: `Mutex<T>`

When tasks must update one value, put it in a `Mutex`. The value lives inside
the lock, and the only way to it is the guard that `using g = m.lock()`
binds, which holds the lock until its block ends:

```ts nish:ok
import { Mutex, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const addMany = (total: Mutex<Counter>): i32 => {
  for (let k: i32 = 0; k < 100000; k++) {
    using g = total.lock(); // waits for the lock, and holds it to the end of the block
    g.value.n = g.value.n + 1;
  }                         // released here, on every pass
  return 0;
};

export const main = (): i32 => {
  const total = new Mutex<Counter>(new Counter());
  const done: i32[] = [0, 0, 0, 0];
  {
    using s = scope();
    for (let t: i32 = 0; t < 4; t++) {
      s.spawn(addMany, total, done, t);
    }
  }
  using g = total.lock();
  console.log(`${g.value.n}`); // 400000
  return 0;
};
```

- **The value is fresh all the way down**: `new Mutex<Counter>(new Counter())`,
  never a value you still hold another reference to, which would be a way
  round the lock.
- **Use the guard only as `g.value`, and only to read or store a number, a
  `boolean` or an enum through it.** Don't bind `g` or `g.value` to another
  name, pass them on, or keep an array they reach: anything that outlives the
  block would outlive the lock.
- **One lock at a time, and no waiting while you hold it.** Inside a guard's
  block — directly or through any call — there is no second `lock()`, no
  `scope()` and no parallel map. That is why a program that compiles cannot
  deadlock.
- **Make the updates commute**, as a count or an integer sum does. Natively
  the tasks take the lock in whatever order the scheduler picks, and under
  Node they take it in spawn order; only an order-independent update prints
  the same both ways.
- **A lock nobody holds is cheap; keep the block short.** Taking a free lock
  is one atomic instruction. A task that finds the lock held checks again 64
  times in a tight loop and then keeps checking, giving its core up to
  another thread before each check, so a long block makes every waiter spend
  processor time waiting for it.

```ts nish:err NL2465
import { Mutex } from "nish/threads";

class Counter {
  n: i32 = 0;
}

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  const g = m.lock(); // a guard not bound by `using` would never be released
  return g.value.n;
};
```

## Counting without a lock: `AtomicI32` and `AtomicI64`

When what tasks share is a counter, or one per bin of a histogram, an atomic
is cheaper than a lock. Each method is one indivisible step, so no update is
lost when two threads make one at the same moment:

```ts nish:ok
import { AtomicI32, parallelMapInto, scope } from "nish/threads";

class Shard {
  xs: i32[];
  bins: AtomicI32[];
  constructor(xs: i32[], bins: AtomicI32[]) {
    this.xs = xs;
    this.bins = bins;
  }
}

const binShard = (s: Shard): i32 => {
  for (const x of s.xs) {
    const bin: i32 = x & 3;
    s.bins[bin].add(1); // one indivisible increment, no lock
  }
  return 0;
};

export const main = (): i32 => {
  const bins: AtomicI32[] = [new AtomicI32(0), new AtomicI32(0), new AtomicI32(0), new AtomicI32(0)];
  const done: i32[] = [0, 0];
  {
    using s = scope();
    s.spawn(binShard, new Shard([1, 2, 3, 4, 5], bins), done, 0);
    s.spawn(binShard, new Shard([6, 7, 8], bins), done, 1);
  }
  const big = new AtomicI32(0);
  const xs: i32[] = [3, 9, 4];
  const ys: i32[] = [0, 0, 0];
  parallelMapInto(xs, ys, (x) => big.max(x)); // a parallel function may update an atomic
  console.log(`${bins[0].load()} ${bins[1].load()} ${big.load()}`); // 2 2 9
  return 0;
};
```

- **The methods**: `load()`, `store(v)`, `add(n)`, `sub(n)`, `min(v)`,
  `max(v)`, `exchange(v)` and `compareExchange(expected, desired)`. Each
  update gives back the value the counter held just before it;
  `compareExchange` stores `desired` only when the counter holds `expected`,
  and gives back what it found either way.
- **Only call its methods.** The number inside is not a field you can read or
  store.
- **Don't touch it in the scope's block once the first task is spawned.** Read
  it before the first `spawn` or after the block, when every task has
  finished.
- **Make the updates commute.** `add`, `sub`, `min` and `max` give the same
  total whatever order the threads made them in; a `store`, an `exchange`, or
  an answer that depends on a value another task is changing does not, and
  would print differently natively and under Node.
- **An `AtomicI64` holds an `i64`.** Under Node that is a `bigint`, so pass it
  `i64` values.
- **It is cheaper than a lock, not free.** Four tasks incrementing the same
  few counters still wait on each other's cores; when the work allows it, count
  into a local tally and add it once at the end.

```ts nish:err NL2512
import { AtomicI32, scope } from "nish/threads";

const bump = (a: AtomicI32): i32 => a.add(1);

export const main = (): i32 => {
  const a = new AtomicI32(0);
  const done: i32[] = [0];
  let seen: i32 = 0;
  {
    using s = scope();
    s.spawn(bump, a, done, 0);
    seen = a.load(); // the task may not have run yet
  }
  return seen;
};
```

## Passing values: `Channel<T>`

A `Channel` carries numbers from the tasks that produce them to one that
consumes them. Producers call `send`, which never waits; the consumer walks
the channel with `for...of`, which waits for values and ends once every task
that may send has returned. Nobody closes a channel, so nobody can close one
too early.

```ts nish:ok
import { Channel, scope } from "nish/threads";

class Pipe {
  ch: Channel<i32>;
  n: i32;
  constructor(ch: Channel<i32>, n: i32) {
    this.ch = ch;
    this.n = n;
  }
}

const produce = (p: Pipe): i32 => {
  for (let i: i32 = 1; i <= p.n; i++) {
    p.ch.send(i);
  }
  return p.n;
};

const consume = (p: Pipe): i32 => {
  let sum: i32 = 0;
  for (const x of p.ch) {
    sum = sum + x;
  }
  return sum;
};

export const main = (): i32 => {
  const sent: i32[] = [0, 0];
  const sums: i32[] = [0];
  const ch = new Channel<i32>();                 // a `const`, right before its scope
  {
    using s = scope();
    s.spawn(produce, new Pipe(ch, 10), sent, 0); // every sender first
    s.spawn(produce, new Pipe(ch, 20), sent, 1);
    s.spawn(consume, new Pipe(ch, 0), sums, 0);  // then the one receiver
  }
  console.log(`${sums[0]}`); // 265
  return 0;
};
```

- **A channel carries a number, a `boolean` or an enum.** Never a string, an
  array or an object.
- **Declare it as a `const` just before its scope**, and hand it to a task as
  the task's argument or as a field of the object you build for it in the
  `spawn`, as `new Pipe(ch, 10)` does. Don't bind it to another name, store it
  anywhere else or return it. `new Channel<i32>()` takes no capacity: a
  channel is unbounded.
- **In the constructor of a class that holds a channel, use `this` only for its
  own fields**: set them, update them, read the ones that are numbers, strings
  or arrays of those, and store into what a channel-free field holds. Never
  hand `this` on, call a method on it, or keep it anywhere.
- **One scope and one receiver.** Only one scope's tasks use a channel, and it
  has exactly one receiver: a single task, or the parent after the scope's
  block. The parent sends only before the block.
- **Spawn every sender before the receiver**, and never let one task both send
  and receive on the same channel. Channels cannot deadlock because of this
  order.
- **Print what the interleaving cannot change.** Values from two senders
  arrive in the scheduler's order natively and in spawn order under Node, so a
  sum or a count is the same both ways and a list of the values is not.

The full rules, and the code each one is refused with, are in the reference:
[Data parallelism](../../LANGUAGE.md#data-parallelism-nishthreads),
[Scoped tasks](../../LANGUAGE.md#scoped-tasks-using-s--scope),
[`Mutex<T>`](../../LANGUAGE.md#a-lock-that-owns-its-data-mutext),
[Atomics](../../LANGUAGE.md#atomics-atomici32-and-atomici64) and
[`Channel<T>`](../../LANGUAGE.md#channels-channelt).
