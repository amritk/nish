# Threads

Nish runs code on several threads without letting two threads race on the
same memory. It does that by offering a few shapes of parallel work, each
with rules the compiler checks, instead of raw threads and shared variables:

- **`parallelMapInto` and `parallelReduce`** — one function over every element
  of an array.
- **`scope()`** — a handful of different tasks at once, joined when a block
  ends.
- **`Mutex<T>`** — one value that a scope's tasks all update.
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
  share is big enough to pay for starting it, judged from what `f` costs, so
  there is no reason to guard a call by size.
- **`dst` must be at least as long as `src`**, or the call panics before it
  writes anything. `src` and `dst` may be the same array.
- **`f` writes nothing its caller can see** — no store through its argument,
  no `console.log` — and **answers a number, a `boolean` or an enum**. It may
  build strings and arrays on the way to its answer; they are freed after each
  element, and the compiler warns that each element pays for that.
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

## Different tasks at once: `using s = scope()`

A scope runs different functions side by side, one thread each. Open it with
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
  task could read.
- **A task is a named top-level function**, not an arrow, so a debugger or a
  profiler can name its thread. It follows the rules of a parallel `f` above:
  it writes nothing another thread can see (except through a `Mutex` or a
  `Channel`, below), answers a number, a `boolean` or an enum, and opens no
  scope of its own.
- **A scope never leaves its block.** It is only ever the receiver of
  `spawn`: passing, storing or returning it is refused, and so is a scope
  bound without `using`.

Each task runs on a thread of its own; a scope with more tasks than cores
leaves the operating system to share them out.

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
[`Mutex<T>`](../../LANGUAGE.md#a-lock-that-owns-its-data-mutext) and
[`Channel<T>`](../../LANGUAGE.md#channels-channelt).
