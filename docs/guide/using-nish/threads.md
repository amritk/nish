# Threads

Nish runs code on several threads without letting two threads race on the
same memory. It does that by offering a few shapes of parallel work, each
with rules the compiler checks, instead of raw threads and shared variables.
Pick the shape by what the work is:

| You need | Reach for |
| --- | --- |
| the same work on every element of an array | [`parallelMap`](#a-new-array-parallelmap-and-parallelfrom) / [`parallelMapInto`](#one-function-over-an-array-parallelmapinto-and-parallelreduce) |
| a fold: a sum, a count, a maximum | [`parallelReduce`](#one-function-over-an-array-parallelmapinto-and-parallelreduce) |
| a few unlike jobs at once | [`scope` + `spawn`](#different-tasks-at-once-using-s--scope) |
| a shared counter, minimum, maximum or flag | [`AtomicI32` / `AtomicI64`](#counting-without-a-lock-atomici32-and-atomici64) |
| a shared structure that tasks update | [`Mutex<T>`](#sharing-a-value-mutext) |
| a pipeline: tasks that produce values for one that consumes them | [`Channel<T>`](#passing-values-channelt) |

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
  `process.exit` — and **answers a number, a `boolean`, an enum, a `string`, or
  an array of numbers, booleans or enums** (a reduce's `f` only the first
  three; see below). It may
  look keys up in a `Map` or `Set` its element reaches (`get`, `has`, `size`),
  and it may `panic`: if several elements panic at once, only the first
  prints its message, and the program exits 1. It may
  build strings and arrays on the way to its answer; they are freed after each
  element, and the compiler warns that each element pays for that. An array it
  makes itself, keeps in a `const` and hands to nothing that keeps it is its
  own: it may fill it, `push` onto it, or pass it to a helper that writes it.
- **A string or an array is copied out once, then handed over.** Each thread
  copies the answers it built into a block of its own before the next element
  reuses its arena. Once every thread has finished, the caller takes those
  blocks into its own arena whole when they hold 64 KB or more, and copies the
  answers in when they hold less, so the array you get back holds strings you
  own. An array of strings, an array of arrays,
  an object, a `Map` or a `Set` is refused: copying one would mean following
  every element.
- **A reduce folds numbers, booleans or enums.** Its `f` answers the same type
  it takes, on many threads at once, so a string there is refused; map the
  strings to numbers first, `parallelReduce(parallelMap(words, (w) => w.length),
  (a, b) => a + b, 0)`.
- **A reduce is deterministic.** The array is folded in fixed blocks and the
  blocks are combined in order, so an `f64` sum is the same bits on one core or
  sixty-four. For that to be the fold you meant, `f` must be associative and
  `identity` its identity: `(a, b) => a - b`, or `+` with an identity of `1`,
  is refused.

**What is refused, and why.** An `f` that prints, stores through its
argument or writes anything else its caller can see is refused at the call
(NL2345 for output), because every thread would make that write at once and
the order would be the scheduler's. So is a reduce whose arrow is plainly not
associative, because the blocks are combined in a fixed order. The rules are
in the reference, [Data parallelism](../../LANGUAGE.md#data-parallelism-nishthreads).

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

The answer may be a string or an array of numbers, too; each one is copied out
of the thread that built it, so it lives as long as the array you get back:

```ts nish:ok
import { parallelFrom, parallelMap } from "nish/threads";

export const main = (): i32 => {
  const names = parallelFrom(3, (i) => `worker-${i}`);    // worker-0 worker-1 worker-2
  const lengths = parallelMap(names, (s) => s.length);    // 8 8 8
  const tags = parallelMap(names, (s) => s.substring(7)); // 0 1 2
  console.log(`${names[2]} ${lengths[0]} ${tags[1]}`);    // worker-2 8 1
  return 0;
};
```

Each thread moves the strings its elements answer into blocks of its own, and
the caller takes the blocks whole at the join rather than copying each string
again, so the copy runs on every thread at once. A map of a million
`` `s${x % 100000}` `` strings took a median of 24 ms on 4 threads (22 to 32 ms
over nine runs), against 40 ms for the sequential loop. On one thread the same
map takes 65 ms, since every element still pays the move, so measure your own
case. Reach for the threads when each element does some work, or when there is
more than one core to run it.

**What is refused, and why.** The rules for `f` above, and an answer that is
an array of strings, an array of arrays, an object, a `Map` or a `Set`
(NL2348): each thread's memory is reused for its next element, and copying
such an answer out of it would mean following every element. Answer a string
or a number per element, and build the structure from them after the call.

```ts nish:err NL2348
import { parallelFrom } from "nish/threads";

export const main = (): i32 => {
  const rows = parallelFrom(3, (i) => [`row-${i}`]); // a string[] per element
  return rows.length;
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

Each of these is refused because every thread reads the same value at once:
a write to it, or a `let` that changes under the threads, would make the
answer depend on which thread ran first.

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
  `process.exit` are all refused), answers a number, a `boolean`, an enum, a
  `string` or an array of numbers, booleans or enums when it has a
  destination — a string or an array is copied into the parent's memory when
  the scope joins — and opens no scope of its own. Looking a key up
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

**What is refused, and why.** Every refusal in a scope keeps one promise:
nothing a task reads changes while the task may be running. So a scope bound
without `using` is refused, since its tasks might never be joined (NL2388).
Reading a destination inside the block is refused, since its answer is not
there yet, and so is writing memory a task reads, since the task would see
whichever value was there when its thread got to it. Reading a `let` from an
arrow task is refused for the same reason (NL2506): the `let` could change
before the task runs. [`nish --fix`](#letting-nish---fix-write-it) repairs the
missing `using` and the captured `let`; a destination read early or a write a
task would see is yours to move after the block.

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
  `boolean`, an enum or a `string` through it.** A string you store is copied
  into memory the `Mutex` owns, and one you read is copied out to you, so
  neither side keeps a pointer the other can free. You may hand `g` to a
  function of your own, called by name — `bump(g)` with
  `const bump = (g: MutexGuard<Counter>): void => { … }` — which uses it the
  same way. Don't bind `g` or `g.value` to another name, store or return
  either, or keep an array they reach: anything that outlives the block would
  outlive the lock (NL2466 for the guard, NL2467 for what it reaches).
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

A helper that takes the guard does the block's work under the block's lock,
so the work can be split into functions without taking the lock twice:

```ts nish:ok
import { Mutex, MutexGuard, scope } from "nish/threads";

class Stats {
  count: i32 = 0;
  total: i32 = 0;
}

const note = (g: MutexGuard<Stats>, x: i32): void => {
  g.value.count = g.value.count + 1; // the helper uses `g` as the block would
  g.value.total = g.value.total + x;
};

const addAll = (stats: Mutex<Stats>, xs: i32[]): void => {
  for (const x of xs) {
    using g = stats.lock();
    note(g, x);
  }
};

export const main = (): i32 => {
  const stats = new Mutex<Stats>(new Stats());
  const low: i32[] = [1, 2, 3];
  const high: i32[] = [40, 50];
  {
    using s = scope();
    s.spawn(() => addAll(stats, low));
    s.spawn(() => addAll(stats, high));
  }
  using g = stats.lock();
  console.log(`${g.value.count} ${g.value.total}`); // 5 96
  return 0;
};
```

**What is refused, and why.** The guard is the lock, so anything that could
keep the guard past its block is refused. A helper is a plain function called
by name. Binding, storing, returning or walking the guard itself is refused
(NL2466), and handing `g` to a method, a constructor or a generic function is
refused too (NL2536), since `this` or a type parameter is a way for the guard
to be kept, and so is handing it twice in one call. Binding, storing,
returning or walking an object read through the guard, `const c = g.value`, is
refused (NL2467); storing anything but a number, a `boolean`, an enum or a
`string` into it is refused (NL2468), and so is storing `null` (NL2537), which has
no string to copy into the `Mutex`.
A guard bound with `const` would never be released (NL2465). A second lock
inside a guard's block is refused because two tasks each holding one lock and
waiting for the other would wait forever.

```ts nish:err NL2536
import { Mutex, MutexGuard } from "nish/threads";

class Stats {
  count: i32 = 0;
}

class Log {
  last: i32 = 0;
  note(g: MutexGuard<Stats>): void { // a method: `this` is a second way out
    this.last = g.value.count;
  }
}

export const main = (): i32 => {
  const stats = new Mutex<Stats>(new Stats());
  const log = new Log();
  using g = stats.lock();
  log.note(g);
  return log.last;
};
```

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
lost when two threads make one at the same moment. The fast pattern is the one
below: each task counts into its own local array, then adds each count to the
shared atomic once, at its end:

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
  const local: i32[] = [0, 0, 0, 0]; // this task's own counts
  for (const x of s.xs) {
    const bin: i32 = x & 3;
    if (bin < local.length) {
      local[bin] += 1;
    }
  }
  for (let b = 0; b < local.length; b++) {
    s.bins[b].add(local[b]); // one indivisible add per bin, no lock
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
- **Scopes opened by one `using` share nothing.** In
  `using s = scope(), t = scope()`, `t`'s tasks finish before `s`'s natively,
  and under Node each runs where it is spawned, so a task of `s` and a task of
  `t` may not use the same destination array, the same atomic or the same lock.
  Two counters each made with `new` in a `const` of their own are two counters,
  and their tasks are fine side by side; one counter reached through a second
  name or a field counts as any counter of its type. Open scopes that share
  something in `using` statements of their own.
- **Make the updates commute.** `add`, `sub`, `min` and `max` give the same
  total whatever order the threads made them in; a `store`, an `exchange`, or
  an answer that depends on a value another task is changing does not, and
  would print differently natively and under Node.
- **An `AtomicI64` holds an `i64`.** Node holds it as a `number`: it agrees
  with native while values stay within ±2^53, and wrapping at 2^63 is
  native-only, the same limit as every `i64`. Pass it `i64` values, not
  `toI64` of a number, which is a BigInt under Node.
- **Update it once per batch, not once per value.** An atomic is cheaper than
  a lock, not free: four tasks incrementing the same few counters wait on each
  other's cores. Binning 32 million values into 256 bins on four cores
  (`examples/histogram-atomic.ts`) takes 24 ms with a local tally and one `add`
  per bin, 77 ms on one thread, and 677 ms with one `add` per value.

**What is refused, and why.** An atomic is safe to update from any task, but
its value is only an answer once every task has finished. So reading it inside
the scope's block after the first `spawn`, while the tasks may still be adding
to it, is refused (NL2513): the number would depend on how far each thread had got. Two scopes
opened by one `using` may not share an atomic either (NL2516), since natively
one scope's tasks finish before the other's start and under Node they run as
they are spawned, so the two would print different answers.

```ts nish:err NL2513
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

Read it once the block has closed, when every task has finished:

```ts nish:ok
import { AtomicI32, scope } from "nish/threads";

const bump = (a: AtomicI32): i32 => a.add(1);

export const main = (): i32 => {
  const a = new AtomicI32(0);
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(bump, a, done, 0);
  }
  const seen = a.load(); // every task has finished
  console.log(`${seen}`); // 1
  return 0;
};
```

```ts nish:err NL2516
import { AtomicI32, scope } from "nish/threads";

const bump = (a: AtomicI32): i32 => a.add(1);
const peek = (a: AtomicI32): i32 => a.load();

export const main = (): i32 => {
  const a = new AtomicI32(0);
  const bumped: i32[] = [0];
  const seen: i32[] = [0];
  {
    using s = scope(), t = scope(); // t's tasks finish first natively
    s.spawn(bump, a, bumped, 0);
    t.spawn(peek, a, seen, 0);
  }
  return seen[0];
};
```

## Passing values: `Channel<T>`

A `Channel` carries numbers or strings from the tasks that produce them to one that
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

- **A channel carries a number, a `boolean`, an enum or a `string`.** A string
  is copied when it is sent and again when it is received, so the receiver
  owns what it gets. Never an array or an object.
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

**What is refused, and why.** A program that compiles cannot wait forever on
a channel, and gives the same answer natively and under Node. A receiver
spawned before a sender is refused (NL2481): under Node, where tasks run one
after another in spawn order, it would find the channel empty and end before
the sender ran. So is a task that both sends and receives, a second receiver,
and a channel kept past its scope, each of which could leave a receiver
waiting for a value no task will send.

```ts nish:err NL2481
import { Channel, scope } from "nish/threads";

const one = (ch: Channel<i32>): i32 => {
  ch.send(1);
  return 1;
};

const drain = (ch: Channel<i32>): i32 => {
  let sum: i32 = 0;
  for (const x of ch) {
    sum = sum + x;
  }
  return sum;
};

export const main = (): i32 => {
  const out: i32[] = [0, 0];
  const ch = new Channel<i32>();
  {
    using s = scope();
    s.spawn(drain, ch, out, 0); // the receiver first: under Node it finds nothing
    s.spawn(one, ch, out, 1);
  }
  return out[0];
};
```

## What crosses between threads

Each task has memory of its own, freed when the scope joins, so a value that
leaves a task is copied into the memory of whoever receives it:

```ts nish:ok
import { Mutex, scope } from "nish/threads";

class Last {
  name: string = "";
}

const label = (n: i32): string => `job-${n}`;

const record = (box: Mutex<Last>): void => {
  using g = box.lock();
  g.value.name = label(3); // copied into memory the Mutex owns
};

export const main = (): i32 => {
  const names: string[] = ["", ""];
  const last = new Mutex<Last>(new Last());
  {
    using s = scope();
    s.spawn(label, 1, names, 0); // the answer is copied out at the join
    s.spawn(label, 2, names, 1);
    s.spawn(record, last);
  }
  using g = last.lock();
  console.log(`${names[0]} ${names[1]} ${g.value.name}`); // job-1 job-2 job-3
  return 0;
};
```

- **Crosses:** a number, a `boolean`, an enum, a `string`, and an array of
  numbers, booleans or enums. That covers a task's answer stored in its
  destination, each element of a `parallelMap` or `parallelFrom` that answers
  strings, a value sent on a `Channel<string>`, and a string stored through a
  guard.
- **Doesn't cross:** an object of a class, an array of arrays, a `string[]`,
  a `Map` or a `Set`. Each holds pointers into the task's memory, which is
  gone once the task is joined, so an entry or a map that answers one is
  refused. Answer the numbers or strings it is built from, or build it after
  the scope from what the tasks answered.
- **The copy back runs on every thread.** A `parallelMap` or `parallelFrom`
  element that is a string or an array is moved into a block of its chunk's
  as it is answered, and the joining thread takes the blocks whole, so a map
  of a million short strings took a median of 24 ms on four threads, against
  40 ms for the same loop on one. A scope's task answer is copied in by the
  joining thread when it is under 64 KB, and taken whole above that.

## Letting `nish --fix` write it

Most refusals in a thread program have one usual repair, and
[`nish --fix`](cli.md#--fix) writes it in your source and compiles again.
This task reads a `let` that changes before the scope:

```ts nish:err NL2506
import { scope } from "nish/threads";

export const main = (): i32 => {
  let k: i32 = 3;
  k = k + 1;
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn((n: i32): i32 => n * k, 5, out, 0); // NL2506: `k` could change first
  }
  console.log(`${out[0]}`);
  return 0;
};
```

`nish --fix main.ts` snapshots it in a `const` just before the `spawn`, which
the task may read:

```ts nish:ok
import { scope } from "nish/threads";

export const main = (): i32 => {
  let k: i32 = 3;
  k = k + 1;
  const out: i32[] = [0];
  {
    using s = scope();
    const kNow = k;
    s.spawn((n: i32): i32 => n * kNow, 5, out, 0); // reads the snapshot
  }
  console.log(`${out[0]}`); // 20
  return 0;
};
```

It writes these repairs: `const` becomes `using` for a scope or a guard
bound without it (NL2388, NL2465); a task that answers a number or a
`boolean` with nowhere to store it gets a destination,
`const answer = new Array<i32>(1)` for an `i32` task, above the scope and `, answer, 0` after its
arguments (NL2511); a `let` an arrow task or a `parallelMap` arrow reads gets
a `const` snapshot (NL2506, NL2500); and an arrow that uses a channel moves to
a top-level `const`, `mainTask`, which the `spawn` names (NL2484). It writes a
repair only where your source alone decides it, so it leaves alone a `spawn`
in a loop, where every task would write the one slot; a `let` another
argument of the call names, or one a `for` header declares; and a channel
arrow that captures a local or leaves a parameter's or its result's type out,
which would not check at the top level; those stay refused for you to fix by hand. The reference lists each case:
[What `nish --fix` writes for a thread program](../../LANGUAGE.md#what-nish---fix-writes-for-a-thread-program).

## Refused, and what to write instead

Every refusal on this page ends with the code to write in its place, in your
program's own names where the compiler has them. This table pairs each one
with an example on this page that compiles.

| Code | Refused | Write instead |
|---|---|---|
| NL2345 | `f` of a parallel call writes what its caller can see, or prints | `f` answers the value, `const square = (x: f64): f64 => x * x`, and the call writes it, `parallelMapInto(src, dst, square)`: [the first example](#one-function-over-an-array-parallelmapinto-and-parallelreduce) |
| NL2348 | an element answer that is an array of strings or arrays, an object, a `Map` or a `Set` | answer a string or a number per element, `const squares = parallelFrom(5, (i) => i * i)`, and build the structure after the call: [`parallelFrom`](#a-new-array-parallelmap-and-parallelfrom) |
| NL2503 | a parallel arrow writes a local of its function | answer the value from the body instead, and fold the answers with `parallelReduce`, `const total = parallelReduce(dst, (a, b) => a + b, 0.0)`: [the first example](#one-function-over-an-array-parallelmapinto-and-parallelreduce) |
| NL2500 | a parallel arrow reads a `let` | a `const` snapshot before the call, `const kNow = k`: [below](#a-let-read-by-a-parallel-arrow) |
| NL2388 | `scope()` bound without `using` | `using s = scope()`: [below](#a-scope-bound-without-using) |
| NL2506 | an arrow task reads a `let` | a `const` snapshot before the `spawn`, `const kNow = k`: [`nish --fix`](#letting-nish---fix-write-it) |
| NL2511 | a task that answers a value has no destination | `const answer = new Array<i32>(1)` above the scope and `s.spawn(twice, 21, answer, 0)`: [below](#a-task-answer-with-nowhere-to-go) |
| NL2465 | `m.lock()` bound without `using` | `using g = total.lock()`: [`Mutex<T>`](#sharing-a-value-mutext) |
| NL2536 | a guard handed to a method, a constructor or a generic function | a top-level helper, `const note = (g: MutexGuard<Stats>, x: i32): void => {`, called as `note(g, x)`: [the helper](#sharing-a-value-mutext) |
| NL2513 | an atomic read inside the scope's block after a `spawn` | read it after the block, `const seen = a.load()`: [atomics](#counting-without-a-lock-atomici32-and-atomici64) |
| NL2516 | two scopes of one `using` share an atomic | one `using` per scope, `using s = scope()` and `using t = scope()`: [below](#two-scopes-that-share-an-atomic) |
| NL2481 | a channel's receiver spawned before a sender | spawn every sender first, `s.spawn(produce, new Pipe(ch, 10), sent, 0)` above `s.spawn(consume, new Pipe(ch, 0), sums, 0)`: [`Channel<T>`](#passing-values-channelt) |
| NL2484 | an arrow that uses a channel | a module function the `spawn` names, `const sendOne = (c: Channel<i32>): void => {` and `s.spawn(sendOne, ch)`: [below](#a-channel-in-an-arrow) |

### A `let` read by a parallel arrow

```ts nish:err NL2500
import { parallelMap } from "nish/threads";

export const main = (): i32 => {
  let k: i32 = 3;
  k = k + 1;
  const xs: i32[] = [1, 2, 3];
  const ys = parallelMap(xs, (x: i32): i32 => x * k); // `k` is a `let`
  return ys[0];
};
```

Snapshot it in a `const` before the call, as `nish --fix` does:

```ts nish:ok
import { parallelMap } from "nish/threads";

export const main = (): i32 => {
  let k: i32 = 3;
  k = k + 1;
  const xs: i32[] = [1, 2, 3];
  const kNow = k;
  const ys = parallelMap(xs, (x: i32): i32 => x * kNow);
  console.log(`${ys[2]}`); // 12
  return 0;
};
```

### A scope bound without `using`

```ts nish:err NL2388
import { scope } from "nish/threads";

const twice = (n: i32): i32 => n * 2;

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    const s = scope(); // never joined: its task might never run
    s.spawn(twice, 21, out, 0);
  }
  return out[0];
};
```

Declare it with `using`, so the block's end joins it, as `nish --fix` does:
`using s = scope()`, as in [the first scope example](#different-tasks-at-once-using-s--scope).

### A task answer with nowhere to go

```ts nish:err NL2511
import { scope } from "nish/threads";

const twice = (n: i32): i32 => n * 2;

export const main = (): i32 => {
  {
    using s = scope();
    s.spawn(twice, 21); // the answer has nowhere to go
  }
  return 0;
};
```

Give the answer a one-slot destination above the scope, as `nish --fix` does,
and read it after the block:

```ts nish:ok
import { scope } from "nish/threads";

const twice = (n: i32): i32 => n * 2;

export const main = (): i32 => {
  const answer = new Array<i32>(1);
  {
    using s = scope();
    s.spawn(twice, 21, answer, 0);
  }
  console.log(`${answer[0]}`); // 42
  return 0;
};
```

### Two scopes that share an atomic

The [NL2516 example](#counting-without-a-lock-atomici32-and-atomici64) opens two
scopes in one `using`. Give each scope its own block, so the first one's tasks
have finished before the second one's start, natively and under Node alike:

```ts nish:ok
import { AtomicI32, scope } from "nish/threads";

const bump = (a: AtomicI32): i32 => a.add(1);
const peek = (a: AtomicI32): i32 => a.load();

export const main = (): i32 => {
  const a = new AtomicI32(0);
  const bumped: i32[] = [0];
  const seen: i32[] = [0];
  {
    using s = scope();
    s.spawn(bump, a, bumped, 0);
  }
  {
    using t = scope();
    t.spawn(peek, a, seen, 0);
  }
  console.log(`${seen[0]}`); // 1
  return 0;
};
```

### A channel in an arrow

```ts nish:err NL2484
import { Channel, scope } from "nish/threads";

export const main = (): i32 => {
  const ch = new Channel<i32>();
  {
    using s = scope();
    s.spawn((c: Channel<i32>): void => { c.send(1); }, ch); // an arrow with a channel
  }
  let total: i32 = 0;
  for (const v of ch) {
    total = total + v;
  }
  return total;
};
```

Write the task as a module function and name it in the `spawn`, as
`nish --fix` does with `mainTask`:

```ts nish:ok
import { Channel, scope } from "nish/threads";

const sendOne = (c: Channel<i32>): void => {
  c.send(1);
};

export const main = (): i32 => {
  const ch = new Channel<i32>();
  {
    using s = scope();
    s.spawn(sendOne, ch);
  }
  let total: i32 = 0;
  for (const v of ch) {
    total = total + v;
  }
  console.log(`${total}`); // 1
  return 0;
};
```

The full rules, and the code each one is refused with, are in the reference:
[Data parallelism](../../LANGUAGE.md#data-parallelism-nishthreads),
[Scoped tasks](../../LANGUAGE.md#scoped-tasks-using-s--scope),
[`Mutex<T>`](../../LANGUAGE.md#a-lock-that-owns-its-data-mutext),
[Atomics](../../LANGUAGE.md#atomics-atomici32-and-atomici64) and
[`Channel<T>`](../../LANGUAGE.md#channels-channelt).
