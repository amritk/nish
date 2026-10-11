# WP29: The thread surface, and what is legal TypeScript

**Status: P1 and P2 are built; P3 is decided and being built.** P1, `parallelMapInto` and
`parallelReduce`, shipped in 0.11.0 ([#219](https://github.com/amritk/nish/pull/219),
with allocating bodies and the cost-sized grain in [#223](https://github.com/amritk/nish/pull/223)).
P2, `using s = scope()`, shipped in 0.13.0
([#262](https://github.com/amritk/nish/pull/262)). Both live in
`std/threads.ts`, and [LANGUAGE.md](LANGUAGE.md#data-parallelism-nishthreads)
and [its next section](LANGUAGE.md#scoped-tasks-using-s--scope) state their
rules. P3, a lock that owns its data (§4.3) and channels of scalars (§4.4),
is decided and being built, and [MASTER_PLAN](MASTER_PLAN.md#what-remains)
lists it as next.
[wp20-threads.md](wp20-threads.md) records *whether* and *why*: 1:1 OS
threads, data races rejected at compile time, and 3.96x on four cores
(wp20 §8). This note answers the narrower question: **given that a Nish
program must be legal TypeScript, what is the best surface we can actually
spell?** LANGUAGE.md is normative, and wins wherever the two disagree.

---

## 1. The decision

**Take Rust's shapes and Go's posture, and let the compiler supply what both
of them had to ask the programmer for.**

1. **Data parallelism comes first, not last** (§8). The partition belongs to
   the intrinsic, so disjointness is a property of the call. It needs no
   handle, no join proof and no capture analysis.
2. **The spawn primitive is Rust's scoped thread, spelled `using`.** `using` is
   the one block-scoped cleanup construct TypeScript has, so "every task is
   joined on every path" becomes a property of the construct instead of an
   analysis.
3. **A lock owns the data it protects**, as in Rust. `Mutex<T>` holds the `T`,
   and `lock()` returns a guard that `using` releases.
4. **Race freedom comes from the whole-program fixpoint**, not from `Send`/`Sync`
   annotations or a runtime detector. wp20 §1 explains why rejecting races
   statically is not optional: a false attribute is a miscompile.
5. **Nothing detached, no `Arc`, no M:N, no `select` yet** (§9).

---

## 2. The constraint that decides everything: no new keywords

A Nish program is a TypeScript program that `tsc --strict` accepts. So there is
no `go f()`, no `spawn { }` and no `parallel for`. What is available is any
imported function, class or generic with any declared type, plus `using`. A
decorator such as `@parallel` is legal TypeScript, but Phase 0 forbids it, and
it can only mark a declaration, not a region. The design space is *calls,
generic types and one lifetime construct*, and this note's claim is that they
are enough.

---

## 3. What to take from each language, and what to refuse

| From | Taken | Refused |
| --- | --- | --- |
| Rust | scoped threads (as `using`), Rayon's data parallelism (as P1), `Mutex<T>` owning its data | `Send`/`Sync` as traits (a fixpoint instead, wp20 §2), `Arc<T>` (scoped threads remove the need), the borrow checker (§7 replaces it, and is weaker on purpose) |
| Go | the posture that the common case is one line (here, the data-parallel call), synchronous blocking code ([wp24-async.md](wp24-async.md) §2), channels later, `WaitGroup` subsumed by the scope | `go` for cheap spawn (it needs closures and a growable stack, wp20 §1), the race detector |

---

## 4. The surface

```ts
import { parallelMapInto, parallelReduce, scope } from "nish/threads";
```

The surface is one module, resolved as a package subpath through the `nish`
condition. It is `nish/threads` rather than a `nish:` builtin prefix because
it is ordinary Nish that the compiler recognises.

### 4.0 Why an import rather than a global like `Arena`

`Mutex<T>` and `Channel<T>` are constructible generic types. As globals they
would put `Mutex`, `MutexGuard`, `Channel` and `ThreadScope` into every program's
namespace. The import line also shows a reader where threads are used. A
program that imports nothing from `nish/threads` is byte-identical to one built
before the module existed.

### 4.1 Stage P1 — data parallelism, and nothing else

```ts
parallelMapInto(src, dst, (x) => x * 3);        // body at the call site
parallelMapInto(src, dst, square);              // or a named function
const total = parallelReduce(src, (a, b) => a + b, 0);
```

**Status: built.** The two forms rest on these arguments:

- **The intrinsic performs every store.** A body is a pure `(x: T) => U`, so two
  workers cannot write the same slot. `parallelFor(lo, hi, body)` is left out
  on purpose: its body stores for itself, which hands a disjointness obligation
  back to the programmer.
- **"Pure" is a fact of its own.** The fixpoint records a *shared write*
  (`FunctionFacts.sharedWrite`). That excludes panics, traps and allocation,
  and names the node or callee that makes the write. `readnone`/`readonly`
  would be the wrong question, because a bounds check is a write to LLVM. A
  reachability rule refuses a body that could read `dst` through its argument.
- **The module is ordinary Nish.** `std/threads.ts` writes both functions as
  the sequential loop that runs under Node. The compiler recognises the two
  templates by module and name, and replaces the chunk loop with a call to
  `nish_parallel_range` (`src/emit-parallel.ts`).
- **A body may allocate, and gives the memory back per element.** It gets an
  arena scope of its own (`scopeParallelBodies` in `src/attributes.ts`) and the
  warning NL9012 (§8a). A body that touches `Arena` is refused (NL2351).
- **The grain is sized from the body**: `2^22` over a static cost estimate
  (`mapGrain` in `src/parallel.ts`). A map within its grain calls its loop
  directly. P1 first shipped a constant 2^20.
- **`--threads` is implied** by importing the module (wp20 §8c.3). This is a
  soundness requirement: allocation counts as no shared write only because the
  arena is thread-local.
- **`parallelReduce` takes an identity and blocks deterministically** (§11), so
  its answer is the same bits on any core count.

### 4.2 Stage P2 — the scope, for heterogeneous work

```ts
using s = scope();
s.spawn(indexShard, shards, sums, 0);
s.spawn(indexShard, shards, sums, 1);
// joined here, on every path, by the block
```

**Status: built.** `using` does three jobs. It joins on every path, because the
compiler emits the join at every exit of the block, so `reject_thread_unjoined`
and its analysis are not needed. It nests inside WP6's arena bracket. And a
TypeScript reader already knows what it means. Decisions taken in the build:

- **A task runs when its scope joins, not when it is spawned.** `spawn` files
  the task (`nish_scope_spawn`). The join (`nish_scope_join`) runs every task
  at once, the first on the calling thread. It waits for them all, then stores
  the answers on the calling thread in spawn order. The parent runs nothing
  while tasks run, and tasks are held to P1's rule. So there is no
  shareable-argument rule (wp20 T2) and no lending rule (§7): any argument may
  be handed over.
- **A task answers through a destination the parent names:**
  `spawn(entry, arg, dst, at)` stores `dst[at] = entry(arg)` at the join. `R`
  is a number, a `boolean` or an enum.
- **`using` takes only `scope()`**, and a scope comes only from `using`. Since
  [#420](https://github.com/amritk/nish/pull/420), `using` also takes the
  builtin `arena()`. The join is emitted at the block's end, at a `return`,
  and at a `break` or `continue` that leaves the block, inside every arena
  scope. `[Symbol.dispose]` may be declared only in `nish/threads`.
- **The entry is a named top-level function**, because a debugger shows its
  name for the thread. A task cannot spawn or call P1's forms, because both are
  shared writes.
- **Under Node**, `spawn` runs at once. The checker refuses anything that could
  tell the two orders apart ([RUN_UNDER_NODE.md](RUN_UNDER_NODE.md)).
- **Measured** by `examples/tasks.ts`, four unlike tasks of about 0.5 s each on
  the four-core machine of §8a: **1.81 s in sequence, 0.547 s as one scope,
  3.30x**.

P3 changes two of these. A task may also write through a lock's guard (R6),
and a guarded program whose updates do not commute can tell the two orders
apart, which is its author's obligation rather than the checker's ("What a
guarded program means", §4.3).

### 4.3 Stage P3 — a lock that owns its data

```ts
import { Mutex, scope } from "nish/threads";

class Hist {
  bins: i32[];
  constructor() {
    this.bins = [0, 0, 0, 0, 0, 0, 0, 0];
  }
}
class Shard {
  xs: i32[];
  hist: Mutex<Hist>;
  constructor(xs: i32[], hist: Mutex<Hist>) {
    this.xs = xs;
    this.hist = hist;
  }
}

const binShard = (s: Shard): i32 => {
  for (const x of s.xs) {
    using g = s.hist.lock();
    g.value.bins[x & 7] = g.value.bins[x & 7] + 1;
  }
  return 0;
};

export const main = (): i32 => {
  const xs0: i32[] = [1, 2, 3, 9];
  const xs1: i32[] = [1, 4, 5, 6];
  const hist = new Mutex<Hist>(new Hist()); // fresh all the way down (R1)
  const done: i32[] = [0, 0];               // a fresh `const` destination (§4.2)
  {
    using s = scope();
    s.spawn(binShard, new Shard(xs0, hist), done, 0);
    s.spawn(binShard, new Shard(xs1, hist), done, 1);
  }
  {
    using g = hist.lock();                  // after the join, the parent may lock (R7)
    console.log(`${g.value.bins[1]}`);      // 3
  }
  return 0;
};
```

**Status: decided, and being built.** Rust's design, narrowed until no borrow
checker is needed. The reason to copy it rather than ship a bare
`lock()`/`unlock()` pair is that a bare pair leaves an unguarded path to the
data, and this design does not. The only way to name the `Hist` is through a
guard, and the block releases the guard. `using` is used again, for the same
three reasons as in §4.2. Every rule below is narrow on purpose: a narrow rule
can be widened later without a break, and a wide one can only be narrowed by
one, which is the argument P2 used for `using`.

| | Rule | Why |
| --- | --- | --- |
| R1 | `new Mutex<T>(init)` takes a value that is fresh all the way down: `init` is a `new` expression or a literal whose every argument or element is a scalar or is itself fresh by this rule. So `new Hist(bins)` and `[row]`, with `bins` or `row` a named value, are refused. A string literal is fresh. The value inside is reachable only through a guard, and `Mutex` has no public `value`. | An alias kept outside the lock is an unguarded path to the data, which is the thing Rust's design removes. A fresh outer value with a named inner one would keep that alias one level down. A string is immutable, and R4 never stores into one through a guard, so a string literal leaves no path to write. |
| R2 | `m.lock()` is only ever the initialiser of a `using` declaration, the third disposable beside `scope()` and `arena()`. The release is emitted at every exit of the block. At a `return` (or an `orReturn`) the order is the opposite of the join's: the join runs before the returned value is computed, and the release runs after it, before control leaves. So `return g.value.n` reads under the lock. | A guard bound any other way is one nobody releases. A join must come first so the value can read what the tasks stored; a release must come last so the value is read while the lock is held. |
| R3 | A guard is used only as `g.value`, and `g.value` only as the base of a chain of member and element accesses. A chain that is read yields a scalar, or is itself the base of a further access or a store: `g.value.bins[i]` is a read, and `const b = g.value.bins` is refused. When `T` is itself a scalar, as in `Mutex<i32>`, `g.value` is read and stored directly: `g.value = g.value + 1`. Neither the guard nor anything a chain reaches is bound, passed, returned, stored or captured. | Nothing derived from the guard outlives the block that holds the lock. A bound `b` would be guarded data read after the release, or by a task while another writes it under the guard: a race, since R6 restricts only a task's writes. A scalar read out of the guard is a copy, so it carries no path back. |
| R4 | Every store through a guard stores a scalar (a number, a `boolean` or an enum), into a field or into an element of an array that already exists. No method is called through `g.value`, so there is no `push`. | A task's arena is freed at the join (§7). A pointer into it stored in the parent's data would dangle, and a `push` can reallocate the array into that arena. |
| R5 | Inside a guard's block, directly or through any function it calls, there is no second `lock()`, no `scope()` or `spawn`, and no `parallelMapInto` or `parallelReduce`. | One lock is held at a time, and nothing is waited on while it is held. So **a P3 program cannot deadlock**, by construction, with no lock-order analysis. |
| R6 | A task may write shared memory only through a guard. P2's rule is otherwise unchanged. | The lock is the one admitted shared write, which answers §11's question of how P3 fits P2's rule. |
| R7 | Between a scope's first `spawn` and the end of its block, the parent does not lock, directly or through any function it calls, a mutex that any of that scope's tasks can reach. After the join it may. | This is P2's rule that the parent "neither reads a destination nor writes memory a task may read", extended to the lock. Natively the tasks run at the join and under Node at the spawn, so a parent's guarded read or write there would see a different state in each. A helper that locks is the same lock. |
| R8 | A `Mutex` reaches a task as the task's argument, or as a field of a class the argument is. It is never a destination. | This is how a task names shared state at all, and it keeps the reachability that R7 needs computable. |

**What a guarded program means.** The tasks' critical sections run one at a
time, in some order. Natively the order is the scheduler's. Under Node each
task runs to its end at its `spawn` ([RUN_UNDER_NODE.md](RUN_UNDER_NODE.md)),
so the order is spawn order, and spawn order is one of the native orders. The
native runtime uses that order too for any task it could not start on a thread
of its own: it runs those on the joining thread, in spawn order
(`nish_scope_join`).

A program prints the same thing both ways when two conditions hold. Its guarded
updates must commute exactly: integer sums and counts, a min, a histogram. An
`f64` sum does not, because the order changes its bits. And no task's answer or
control flow may depend on guarded state it read. Anything else is its
author's obligation, the same position `parallelReduce` takes on a named
function's associativity (§11). The checker does not try to prove either
condition. **This is the one place P3 weakens §4.2's guarantee** that the
checker refuses anything that could tell the native and Node orders apart.

Under Node the guard's `[Symbol.dispose]` does nothing, because only one task
runs at a time and no lock is ever contended. `lock()` answers a guard over the
value, and the program reads as the sequential one it is.

### 4.4 Stage P3 — channels of scalars

```ts
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
  return 0;
};
const consume = (p: Pipe): i32 => {
  let sum: i32 = 0;
  for (const x of p.ch) {
    sum = sum + x;
  }
  return sum;
};

export const main = (): i32 => {
  const done: i32[] = [0];                         // fresh `const` destinations (§4.2)
  const sums: i32[] = [0];
  const ch = new Channel<i32>();                   // one run of one scope (C2)
  {
    using s = scope();
    s.spawn(produce, new Pipe(ch, 100), done, 0);  // every sender first
    s.spawn(consume, new Pipe(ch, 0), sums, 0);    // then the one receiver
  }
  console.log(`${sums[0]}`);                       // 5050
  return 0;
};
```

**Status: decided, and being built** after the lock. `Channel<T>` was the one
piece of P3 that needed design rather than transcription, and these are the
decisions:

| | Rule | Why |
| --- | --- | --- |
| C1 | `T` is a scalar: a number, a `boolean` or an enum. | A sender's arena is freed at the join (§7), so a non-scalar element would be a pointer into it. Non-scalars wait for copy-at-join. |
| C2 | `new Channel<T>()` is a `const` the parent declares in the block that holds the scope's `using s = scope()`, or in the block around it, with no loop or function boundary between the declaration and the `using`. It reaches a task as R8 says a `Mutex` does: as the argument, or as a field of a class the argument is. It is never a destination. | Each run of the declaration makes a new channel, so each channel serves one run of one scope. A scope inside a loop, or in a function called twice, gets a fresh channel every time, and no channel is used again after it closed. C5 and C6 are computed from the reachability. |
| C3 | A channel is unbounded: `ch.send(x)` never blocks. | A bounded channel can block a sender under Node, where nothing else is running to drain it. |
| C4 | A channel is reachable from the tasks of exactly one scope. The parent may send only before that scope's first `spawn`, and after the join it may only receive. There is no `close()`: a channel closes when every task of the scope that may send on it has returned, and a channel no task may send on is closed when the join starts. "May send" is the call graph from the task's entry reaching `send` on a channel reachable from its argument, so an over-count only closes the channel later. | Go's "who closes it" question, removed: nobody can close a channel too early, or twice. One scope is what makes "every sender has returned" a single moment, so no send can arrive after it. A channel with no senders would otherwise never close, and its receiver would wait forever. |
| C5 | Receiving is `for (const x of ch)`, which takes values off the channel and ends when it is closed and drained. A channel has one receiver: one task, or the parent after the join, never both and never two tasks. Inside a scope's block the parent never receives, directly or through any function it calls. A loop over a channel that is already drained ends at once. | A receive is the one wait, and this keeps the parent's only wait the join. One receiver makes "the receiver sees every value sent" true natively and under Node alike; under Node the first of two receivers would take everything. A drained channel records that it is drained, so a second loop never reads the buffer the first gave back. |
| C6 | Every task that may send on a channel is spawned before every task that may receive on it, and no task both sends and receives on one channel. | Under Node a task runs at its spawn, so a receiver spawned first would wait forever. The native runtime runs a task it could not start on a thread in spawn order too (§4.3), so the rule matters there as well. The same order makes the sender-to-receiver graph acyclic, so **channels cannot deadlock** either. |
| C7 | There is no receive inside a guard's block, directly or through any function it calls, which is R5's "nothing is waited on while a lock is held". A `send` there is allowed, since it never waits. | It keeps the no-deadlock argument whole where locks and channels meet. A helper that receives under a guard waits as surely as a loop written in the block. |

**What a channel program means.** A channel is single-consumer. Its receiver
sees every value sent, and each sender's values in its send order. How two
senders' values interleave is the scheduler's natively, and spawn order under
Node. A receiver whose answer depends on that interleaving is its author's
obligation, as for the lock.

The buffer lives outside every arena, because the senders' arenas are freed at
the join. It is given back when the receiving loop drains a closed channel, and
the channel records that it is drained, so a later loop over it ends at once
rather than reading freed memory. A channel that is never drained keeps its
remainder until the program exits, which the build stage's LANGUAGE.md section
states. Under Node the channel is an array queue: `send` pushes, and the loop
takes values off it as it walks, which C6 makes correct, because every sender
has already run. A second loop finds it empty, as natively. `select` stays
declined (§9).

---

## 5. The legality report, tested

The whole surface, `Mutex` and `parallelFor` included, was put through
`tsc --strict` with `"lib": ["ES2022"]` before anything was built (§10), and
exited 0. Two costs came out of that run, and both have since been paid:

- **`using` needs the disposable protocol.** `runtime/nish.d.ts` declares
  `SymbolConstructor.dispose` and `Disposable`, so a program needs no
  `"ESNext.Disposable"` in its `lib`. Those declarations use `unique symbol`,
  which the language refuses in a program. They are a declaration file the
  compiler never compiles, like the `Arena` and `console` surfaces.
- **`using` used to reach the validator's `var` rule.** It is now parsed as a
  contextual keyword and judged by its own rule.

`using x = notDisposable` is `TS2850` before Nish ever sees the program, so
the `--strict` run does part of the checking.

---

## 6. The one thing the surface needed that did not exist

Every parallel form takes a body, which is a function passed as an argument.
That is [wp23-language-surface.md](wp23-language-surface.md) §6's *compile-time
function parameter*: a callee named at the call or written there as an arrow,
monomorphised per callee, with a direct call in the IR. **It landed with P1**
(0.11.0, [#213](https://github.com/amritk/nish/pull/213)), for a callee the
checker can name and no other kind. The constraint stays. WP28 §7.4 measured a
callee the checker cannot name at 1.26x for the call and up to 8.76x for the
escape proof it forfeits. An intrinsic that accepted one would spend the whole
margin this surface exists to buy.

---

## 7. What replaces the borrow checker, and what a worker may hand back

The arena is thread-local (wp20 T0), so the lifetime question becomes a
question of *where* memory lives. A worker's allocations are freed when its
thread exits, so a pointer into them dangles once the join returns. This is
the same shape as WP15 §2a's `NL2290`/`NL2291` interior-pointer rule. Hence:

- **A worker's result is a scalar** (a number, a `boolean` or an enum).
  `parallelMapInto` with a `string` or class `U` is refused, with a message
  that names the type.
- **Results come back through memory the parent owns**: `dst` for P1 and the
  destination array for P2.
- **Lifting the restriction means a copy at the join** into the parent's arena,
  for a type whose size is known at the boundary. That is a later stage. It is
  also where a `Channel<T>` of a non-scalar lands, so the two should be designed
  together.

The plan's original rule was "a worker may write through a pointer the parent
lent it". It was not needed: P2 runs tasks only while the parent waits (§4.2),
and P1's intrinsic does every store itself.

---

## 8. Why data parallelism was built before spawn

wp20 staged `parallelFor` last. This note reversed that order, for four reasons:

1. **The measured payoff is there**: 3.96x on a compute kernel (wp20 §8).
2. **It is the smallest stage.** It needs the partitioner, which already
   existed (wp20 §8d), plus a known callee and the purity fact.
3. **It is the narrowest form of the sharing rule**: one buffer and scalar
   results, so a mistake is cheap to correct.
4. **It is the form a user reaches for first**, which is Go's lesson.

The order became **P1 data parallelism, P2 the scope, P3 locks and channels**.
In wp20's numbering that is T4, T1, T3.

### 8a. One thing the compiler can do that neither Rust nor Go can

The fixpoint knows whether a parallel body allocates, and wp20 §8a measured
what an undisciplined body costs: about 3x of wall clock and 1.37 GiB against
1.8 MB of peak memory. The plan was a warning. The build went one step further
and gives an allocating body an arena scope per element, so the peak memory
problem disappears. What remains is the per-element cost, and NL9012 reports
it at the call:

```
main.ts:23:3: performance: the body of this `parallelMapInto` allocates per element: `label` answers `i32` but allocates on every call, so each thread marks and releases its arena around every element. Compute the answer without building a string, an array or an object to save both
```

It honours `--no-warn-performance` and `--json`. Measured by `node bench/run.mjs`
on `bench/par_*.ts`, minimum of five runs:

| kernel | loop | `parallelMapInto` | speedup |
| --- | ---: | ---: | ---: |
| `par-compute`: 64 square roots per element, 2^21 elements | 780 ms | 210 ms | **3.71x** |
| `par-nbody`: 1024 bodies, 16 steps | 171 ms | 49.0 ms | 3.49x |
| `par-alloc`: a string built and summed per element, 2^22 elements | 167 ms | 74.9 ms | 2.23x |
| `par-short`: an 8-element map, 2^20 calls | 54.7 ms | 56.1 ms | 0.97x |

`par-alloc` peaks at 34,596 KB as the map, which is its two arrays and nothing
else. Over 40 interleaved runs, `par-short` measured 50.9 ms against the loop's
50.7 by minimum: it is no slower than the loop it replaced.

**The grain's calibration.** The estimate counts one unit per operation, 32 per
allocation and 4 per call. A loop counts its literal trip count, or 64 trips
when the bound is data. Measured time per unit runs from 0.07 ns to 1.6 ns
across the kernels. The target was set by the cheapest body,
`(x) => x * 3 + 1`, at exactly two chunks. With a target of 2^20 it lost 12%
to the loop at 262,144 elements. With 2^22 it wins 1.54x at 1,677,722. The
default of 64 trips is what divides n-body four ways.
[BENCHMARKS.md](BENCHMARKS.md) carries the current numbers.

---

## 9. Declined, with the rule each one breaks

- **A `go`-style detached spawn.** It needs a closure, and an owner for the
  memory after the spawning frame returns. wp20 §3.4 defers detached threads.
- **`Arc<T>`.** Atomic reference counting, for a need that scoped threads
  remove. It arrives with detached threads or not at all.
- **`select` over channels.** It has no closure-free spelling that is also
  legal TypeScript and is not a `select2`, `select3` family. Channels can ship
  without it, and `select` waits for a program that needs it.
- **A configurable thread pool, or `scope(n)`.** That would be a knob before a
  measurement. The partitioner uses `nish_cpu_count()` and caps at 64 chunks.
- **`Atomic<T>` as the first escape hatch.** An escape hatch should be
  designed after the rule it escapes has met real programs (wp20 §6).
- **Decorators (`@parallel`).** Phase 0 forbids them, and they mark
  declarations, not regions.
- **A task handle stored in a field, an array or a variable.** A scope is only
  ever the receiver of `spawn`, which keeps the join local.
- **Async/await as the spelling.** [wp28-compatibility-mode.md](wp28-compatibility-mode.md)
  §6 owns that question, sequenced behind this note.

---

## 10. Appendix: the surface as a declaration file

The whole candidate surface was typechecked with
`tsc --noEmit --strict --lib ES2022 --module Node16`, together with a program
that used every construct, and exited 0. The P1 and P2 halves now exist as real
code in `std/threads.ts` and `runtime/nish.d.ts`. What remains of the candidate
is P3's half:

```ts
/** The lock owns what it protects, so there is no unguarded path to the data. */
export declare class MutexGuard<T> {
  readonly value: T;
  [Symbol.dispose](): void;
}
export declare class Mutex<T> {
  constructor(value: T);
  lock(): MutexGuard<T>;
}

/** Spellable, and not proposed (§9). */
export declare class AtomicI32 {
  constructor(value: number);
  add(delta: number): number;
  load(): number;
}
```

The guard was `Guard<T>` in the typechecked run, and is `MutexGuard<T>` here,
as the build names it (§4.0). P3 also adds `Channel<T>` (§4.4). The full
appendix, including `parallelFor` and the typechecked program, is this
file at commit `c3529665`.

## 11. Open

- **Whether the partitioner belongs in the runtime or in emitted IR.** A
  partition loop is code the optimiser would like to see, and nobody has costed
  the move.
- **Whether R4 widens to strings.** A string stored through a guard is a pointer
  into the task's arena. Once copy-at-join (§7) exists, the store can copy into
  the parent's arena instead.
- **Whether a guard may be passed to a function that provably does not keep
  it.** R3 refuses every call. The escape analysis (`src/escape.ts`) could
  admit a callee that only reads and stores through its parameter.
- ~~How P3 fits P2's rule.~~ **Closed by P3's design (§4.3).** A task may write
  shared memory only through a guard (R6), one lock is held at a time and
  nothing is waited on while it is held (R5), and `using` takes `m.lock()` as
  its third disposable (R2).
- ~~What a `Channel<T>` of a non-scalar costs.~~ **Closed for now by C1
  (§4.4).** A channel carries scalars. Non-scalars arrive with copy-at-join
  (§7), designed together with non-scalar results.
- ~~Identity or initial value for `parallelReduce`.~~ **Closed by P1: an
  identity.** `src` is split into `min(64, ceil(n / 2^20))` blocks. Each block
  is folded from the identity, and the block results are combined left to
  right, the same way on one thread and under Node. An arrow that is plainly
  non-associative is refused when it can be read. For a named function, the
  obligation is its author's.
- ~~Whether `scope()` takes a thread count.~~ **Closed by P2: it does not.**
  Each task is one thread.
- ~~Whether `using` is admitted only beside the threads surface.~~ **Closed by
  P2 with the narrow answer.** `using` takes only the values whose disposal the
  language defines. The narrow answer can be widened without a break, and the
  wide one could only be narrowed by one.
