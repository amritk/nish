# WP29: The thread surface, and what is legal TypeScript

**P1 is built; P2 and P3 are proposed.** §4.1's two forms are in
`std/threads.ts` and [LANGUAGE.md](LANGUAGE.md#data-parallelism-nishthreads)
states their rules; the status note under §4.1 says what was decided on the way
and §11 what closed. [wp20-threads.md](wp20-threads.md) is the
plan of record for *whether* and *why* — 1:1 OS threads, data races rejected at
compile time, T0 and the partitioner built, and the payoff measured at 3.96x on
four cores (wp20 §8). It deliberately left the surface open: "the stage that decides how much
real work is expressible, so it is the one to prototype against a real program
before committing to the surface". This note is that commitment, and the
question it answers is the narrower one: **given that a Nish program must be
legal TypeScript, what is the best surface we can actually spell?**

Read wp20 §1 to §4 first. [LANGUAGE.md](LANGUAGE.md) stays normative; where
they disagree, LANGUAGE.md wins.

---

## 1. The decision

**Take Rust's shapes and Go's posture, and let the compiler supply what both
of them had to ask the programmer for.** Five parts:

1. **Data parallelism comes first, not last.** wp20 orders the work T1 spawn →
   T2 the shareable rule → T3 channels → T4 data parallelism. That order is
   backwards, and §8 says why in detail: the data-parallel intrinsic is where
   the entire measured payoff is, and it is also the *only* stage that needs no
   thread handle, no join proof, no capture analysis and no shareable-argument
   rule — because the partition belongs to the intrinsic, so disjointness is a
   property of the call rather than something a checker has to prove.
2. **The spawn primitive is Rust's scoped thread, spelled `using`.**
   TypeScript will not give us a new keyword, so every construct here has to be
   a call — with exactly one exception, which is *lifetime*. `using` (TS 5.2,
   and legal under `--strict` with no tsconfig change, §5) is the one
   block-scoped deterministic-cleanup construct the language has, and a scoped
   thread group is precisely a block-scoped lifetime. Spelling it that way
   makes "every handle is joined on every path" a property of the construct
   instead of a whole analysis and a diagnostic that wp20 T1 was going to need.
3. **A lock owns the data it protects**, as in Rust: `Mutex<T>` holds the `T`
   and `lock()` returns a guard released by `using`, so there is no unguarded
   path to the value to forget to take the lock for. Generic classes are
   monomorphised as of this month, so this is buildable today rather than
   waiting on WP18.
4. **Race freedom comes from the fixpoint, not from annotations or a
   detector.** This is the part that is neither Rust's nor Go's. Rust asks the
   programmer for `Send`/`Sync` bounds; Go ships a runtime race detector and
   tolerates the bug until it fires. Nish already proves `readnone` and
   `readonly` over the whole call graph for other reasons, so a parallel body
   the fixpoint cannot clear is a compile error that costs the programmer no
   annotation at all — and wp20 §1 shows we have no *choice* but to reject
   statically, because a false attribute is a miscompile rather than a missed
   optimisation.
5. **Nothing detached, no `Arc`, no M:N, no `select` yet.** §9 has the rule
   each of those breaks.

The shape of the answer, in one line: **Rayon's ergonomics, Rust's lifetimes,
Go's one-liner ambition, and no borrow checker — because the whole-program pass
already knows what a borrow checker is asked to be told.**

---

## 2. The constraint that decides everything: no new keywords

A Nish program is a TypeScript program that `tsc --strict` accepts. That is the
project's whole differentiator and it is absolute here: we cannot add `go f()`,
we cannot add `spawn { ... }`, and we cannot add `parallel for`. What we *can*
do is import any name with any declared type, which is far more than it sounds:

| What a concurrency design usually wants | Legal TypeScript? |
| --- | --- |
| a new statement keyword (`go`, `spawn`, `parallel for`) | **no** — and this is the hard limit |
| any imported function, class or generic, with any signature | **yes** — the entire surface is one module |
| generic classes with methods (`Mutex<T>`, `Channel<T>`) | **yes**, and already monomorphised (`tests/cases/gen_box_struct`) |
| block-scoped deterministic cleanup | **yes** — `using`, and only `using` |
| a callback written at the call site | **yes** in TypeScript; not yet in Nish (§6) |
| a decorator as a marker (`@parallel`) | legal TypeScript, **forbidden by Phase 0**, and it can only decorate a declaration rather than a region |
| operator overloading, a custom `for` form, a new modifier | **no** |

So the design space is: *calls, generic types, and one lifetime construct.*
Everything below is built out of exactly those three, and the note's claim is
that they are enough — with `using` doing more work than its one line suggests,
because scoped concurrency is a lifetime problem wearing a concurrency hat.

---

## 3. What to take from each language, and what to refuse

| From Rust | Take? | Why |
| --- | --- | --- |
| **scoped threads** (`thread::scope`) | **yes, as `using`** | join is guaranteed by the block; children may read what the parent owns; no `Arc`, no lifetime annotations. It is the best fit for a language whose arenas are already block-bracketed (WP6) |
| **Rayon** (`par_iter`) | **yes, as the first stage** | disjointness by construction; §8 |
| **`Mutex<T>` owning its data** | **yes** | there is no way to reach the data without the guard, which is the half of the design that survives without a borrow checker |
| `Send` / `Sync` as traits | **no — as a fixpoint** | wp20 §2: with the whole program in hand, a trait system is not needed for the cases threads care about |
| `Arc<T>` | **no** | atomic refcounting, and scoped threads remove the need (wp20 §3.4) |
| the borrow checker | **no** | Nish has escape analysis and a whole-program pass; §7 is what replaces it, and it is weaker on purpose |

| From Go | Take? | Why |
| --- | --- | --- |
| **the posture that the common case is one line** | **yes** | this is Go's real contribution and it is a design value, not a primitive. Our one-liner is the data-parallel intrinsic, not a `go` statement |
| **blocking is fine, so write synchronous code** | **already have it** | every I/O call in the language is synchronous ([wp24-async.md](wp24-async.md) §2), which reads as a limitation until threads exist and then reads as the design |
| **channels** for pipelines | **yes, but later** | `parallelFor` is the wrong tool for producer/consumer. Needs blocking, and `select` needs more (§9) |
| `WaitGroup` / `errgroup` | **subsumed** | the `using` scope *is* a wait group whose `Wait()` cannot be forgotten |
| `go` for cheap spawn | **no** | needs closures and a growable stack; wp20 §1 |
| the race detector | **no** | wp20 §1: we have already spent the assumption a detector would have to preserve |

---

## 4. The surface

All of it is one module, imported by a bare specifier of the kind WP21 S2
landed — a package name plus an `exports` subpath, resolved through the `nish`
condition:

```ts
import { parallelMapInto, parallelReduce, scope, Mutex } from "nish/threads";
```

`nish/threads` rather than a `nish:threads` prefix, because S2 resolves
*package names* through `node_modules` and an `exports` map and not
Node-builtin-style prefixes — and `nish` is already the package a user of the
compiler has installed, so the subpath needs no new resolution machinery at
all.

### 4.0 Why an import rather than a global like `Arena`

Every builtin the language has today is a global: `console`, `Math`, `Arena`,
`process`. By [wp26-stdlib.md](wp26-stdlib.md) §2's rule these belong in that
company — a builtin is for a syscall, a memory layout, or an effect the
whole-program pass has to see, and threads are all three at once, so they are
certainly not a `std/` module written in Nish. But the *spelling* is a separate
question from the implementation, and an import wins it on three counts:

- **`Mutex<T>` and `Channel<T>` are constructible generic types**, not
  namespaced functions. `declare global { class Mutex<T> { ... } }` is legal
  TypeScript, but it puts `Mutex`, `Guard`, `Channel` and `ThreadScope` in the
  global namespace of every program whether or not it spawns anything, where
  they can collide with a user's own names. `Arena.mark()` has no such problem
  because `Arena` is one name with methods under it.
- **A reader can see where they came from.** The import line is the only place
  a program says "this uses threads", which is worth something in review and
  costs nothing.
- **S2 made it free.** Before bare specifiers there was no import spelling that
  was not a relative path, which is why `Arena` is a global; that constraint is
  gone.

A program that imports nothing from `nish/threads` is unchanged, which is the
same property `--threads` has today and the one wp20 §8c wants kept.

### 4.1 Stage P1 — data parallelism, and nothing else

```ts
parallelMapInto(src, dst, (x) => x * 3);        // body at the call site
parallelMapInto(src, dst, square);              // or a named function
const total = parallelReduce(src, (a, b) => a + b, 0);
```

Two forms, and the omission is deliberate: `parallelFor(lo, hi, body)` is in
§10's declaration file to show it is spellable and is **not** in this stage.
The reason is the whole soundness argument. `parallelMapInto`'s body is a pure
`(x: T) => U` and the *intrinsic* performs every store, so there is no way for
two workers to write the same slot and nothing to check beyond the body's
purity. A `parallelFor` body writes for itself, and "it writes only `dst[i]`
for its own `i`" is a comment, not a proof — it is a disjointness obligation
handed back to the programmer, which is exactly the thing this design is trying
not to do. So `parallelFor` waits for either a real disjointness analysis or an
explicitly unchecked framing beside `--unchecked-indexing`, and the first stage
ships the two forms whose safety is structural.

Why this is the right first stage, and it is not only the measurement:

- **Disjointness is the intrinsic's, not the checker's.** The runtime
  partitions `[0, len)` and hands each worker a range. Two workers cannot
  touch the same output slot because the partitioner says so, which is the
  same argument Rayon's `split_at_mut` makes and it needs no borrow checker to
  make it.
- **No closures means no capture analysis.** A body can only reach its
  parameters, because Nish has no function values and nothing to capture with
  (wp20 §2 lists this as an asset; this is the sharpest instance of it). The
  entire "what did the closure capture and who owns it after the spawning
  frame returns" problem — which costs Rust `move` plus `Send` bounds and
  costs Go a garbage collector — does not arise.
- **No handle means no join proof.** There is nothing to store, nothing to
  leak, and no path on which a join can be forgotten.
- **A short array must come out as an ordinary loop.** Dividing costs about
  125 µs for the spawns and joins and 3 ns when it declines to divide
  ([wp20-threads.md](wp20-threads.md) §8e), so the intrinsic's `grain` has to be
  chosen such that a region carries on the order of a millisecond of work before
  it is worth four threads. That is a default the compiler picks, not a knob,
  and it is the reason `parallelMapInto` over eight elements is not slower than
  the loop it replaced.
- **The purity rule is already computed, and it is the only rule.** The body
  must be one the fixpoint clears as `readnone` or `readonly` — it may read
  what the parent owns and may write nothing — and
  `src/codegen/attributes.ts` computes that today, for other reasons, over the
  whole call graph. A body it cannot clear is a compile error naming the write.
  That is the entire race-freedom argument for this stage: no `Send`, no
  `Sync`, no detector, and no annotation.

**Status: built.** `import { parallelMapInto, parallelReduce } from "nish/threads"`
compiles, over the function parameter wp23 §6 now provides. What the build
decided, beyond what is written above:

- **The module is ordinary Nish.** `std/threads.ts` writes both functions as
  the sequential loop — which is what runs under Node and what `npm run check`
  types — and the compiler recognises the two templates by module and name.
  It replaces one call in each instance, the chunk loop over the whole range,
  with a context block and a call to `nish_parallel_range`
  (`self/emit_parallel.ts`), so the length check and its message, the reduce's
  blocking and its combine are the module's code, and the chunk loop keeps its
  bounds proofs and TBAA. There is no `declare global`, no `Disposable` and no
  `using` in P1.
- **"Pure" is a fact of its own.** `readnone`/`readonly` is the wrong
  question: a bounds check, an integer division and an arena allocation are
  all writes to LLVM. The fixpoint records a *shared write*
  (`FunctionFacts.sharedWrite`) that leaves out panics, traps and allocation,
  and names the node or callee that makes one; the rule judges the function
  passed as `f`, never the instance, whose own loop writes `dst[i]`.
- **Purity is not enough, so there is a reachability rule.** A body that only
  reads can still read `dst` through its argument (`T = Row { cells: f64[] }`
  with a `f64[]` `dst`). An array of `dst`'s element type reachable from `T` is
  refused, naming the path.
- **A body may allocate, and gives it back per element.** The result is a
  scalar, per §7. A body that allocates gets an arena scope of its own
  (`scopeParallelBodies` in `self/attributes.ts`) when the escape analysis
  sees every allocation die and the body leaves `Arena` alone, and is refused
  otherwise (NL2352, NL2351). The arena is thread-local, so each element marks
  and releases the arena of the thread it runs on. It compiles with §8a's
  warning, NL9012 — not NL9011, which the arena-loop rule had taken by then.
- **The grain is sized from the body.** `2^22` over the estimated cost of `f`, in
  `[1, 2^22]` (`mapGrain` in `self/parallel.ts`): a static estimate of one
  element, so a cheap body is divided only past about a million elements and
  one with a loop far sooner. Up to the grain the map calls its chunk loop
  directly, which inlines, instead of going through the partitioner. §8a has
  the calibration. P1 first shipped a constant 2^20.
- **`--threads` is implied** by importing the module (wp20 §8c.3). It is a
  soundness requirement rather than a default: allocation is left out of a
  shared write only because the arena is thread-local. A program that does not
  import it is byte-identical.

### 4.2 Stage P2 — the scope, for heterogeneous work

```ts
using s = scope();
s.spawn(indexShard, 0);
s.spawn(indexShard, 1);
// joined here, on every path, by the block
```

`using` is doing three jobs at once, which is why it is worth the one new
construct:

1. **Join on every path, by construction.** wp20 T1's rule 2 was "every handle
   is joined on every path of the frame that spawned it", proved with the same
   CFG analysis as `reject_missing_return`. With `using`, the compiler emits
   the join at every exit of the block, so the rule is not proved — it is
   emitted. That deletes an analysis and the `reject_thread_unjoined`
   diagnostic, and replaces them with one much simpler rule: **a scope must be
   introduced by `using`**, because `const s = scope()` would be a scope
   nobody joins.
2. **It nests inside the arena bracket that already exists.** WP6 brackets a
   dynamic extent with `nish_arena_mark` / `release`; a `using` block is the
   same shape, and the ordering the runtime needs — parent marks, children run
   in their own arenas, children join, parent releases — falls out of nesting
   the join inside the bracket rather than being a new invariant to maintain.
3. **A TypeScript reader already knows what it means.** `using` means
   "disposed at the end of this block" to anyone who has met the construct,
   and that is exactly what it means here. No Nish-specific idiom to learn.

The argument must be shareable (wp20 T2), the entry must be a named top-level
function (free — there is nothing else to pass), and what a worker may hand
back is §7.

### 4.3 Stage P3 — a lock that owns its data

```ts
const hits = new Mutex<Counter>(new Counter());
{
  using g = hits.lock();
  g.value.n = g.value.n + 1;
}
```

Rust's design, unchanged, and the reason to copy it rather than ship a bare
`lock()`/`unlock()` pair is that a bare pair has an unguarded path to the data
and this one does not: the only way to name the `Counter` is through a guard,
and the guard is released by the block. `using` again, for the same three
reasons.

`Channel<T>` belongs in this stage and is the one piece that genuinely needs
design work rather than transcription — see §9.

---

## 5. The legality report, tested

The claim that this is legal TypeScript is the load-bearing one, so it was run
rather than asserted. The declaration file and a program using every construct
above are in §10; `tsc --strict` with `"lib": ["ES2022"]` and no other
configuration accepts both, **exit 0**.

Two things that cost something, both worth saying out loud:

**`using` needs the disposable protocol, and we can ship it ourselves.** With
`"lib": ["ES2022"]` alone, `[Symbol.dispose]` is `error TS2550: Property
'dispose' does not exist on type 'SymbolConstructor'` and `Disposable` is
`error TS2318`. The obvious fix is to make consumers add `"ESNext.Disposable"`
to their `lib`, which works and costs them a line. The better fix, which is
what §10 does, is to declare both in our own `.d.ts`:

```ts
declare global {
  interface SymbolConstructor { readonly dispose: unique symbol }
  interface Disposable { [Symbol.dispose](): void }
}
```

That makes the surface self-contained — a program that imports `nish/threads`
needs no tsconfig change at all — and it is the difference between a feature
and a feature with a setup step.

**Our own declaration file breaks two Phase 0 rules.** `declare global` and
`unique symbol` are both forbidden constructs with rejections of their own, and
the file above uses both. That is not a contradiction — it is a declaration the
compiler special-cases and never a program it compiles, exactly as the builtin
`Arena` and `console` surfaces are — but a note that did not mention it would be
hiding the one place where the shipped surface is spelled in language the
language rejects. If it grates, the alternative is the `lib` line.

**And one thing that is already almost right.** `using` today reaches the
validator's `var` rule and is rejected with `` `var` is forbidden; use `let` or
`const` ``. If `using` is adopted, that message has to split — the rule is
right to reject it *now* and would be wrong to reject it then, and a reader who
writes `using` and is told about `var` learns nothing.

Worth noting what TypeScript enforces for us: `using x = notDisposable` is
`error TS2850` before Nish ever sees it. The `--strict` run is a real part of
the checking here, not a formality.

---

## 6. The one thing the surface needs that does not exist

Every parallel form above takes a body, and a body is a function passed as an
argument — which is `Unsupported type `(n: i32) => i32`` today, because there
are no function values and no function type in the type table.

This is **not** a request to admit function values. It is
[wp23-language-surface.md](wp23-language-surface.md) §6's *compile-time
function parameter*: the callee is written at the call site or named directly,
so the checker knows exactly which function it is and monomorphises the
intrinsic against it. The call that comes out is direct, and
[wp28-compatibility-mode.md](wp28-compatibility-mode.md) §7.4 measured what
that costs: **nothing**. The same spike measured what the *other* kind costs —
a callee the checker cannot name — at 1.26x for the call and up to 8.76x for
the escape proof it forfeits, which is the argument for making sure the
intrinsic only ever takes the first kind.

So the dependency is: wp23 §6 for a statically known callee, and it is a
prerequisite for P1 rather than a nice-to-have. Nothing else on this page needs
a language feature that does not exist.

**That prerequisite is scheduled with P1.** [wp23](wp23-language-surface.md)
§6 left it *not scheduled* until a second real program asked, and named this
section as the first. [MASTER_PLAN](MASTER_PLAN.md#what-remains) makes P1
the next item, which is the decision to build the parameter with it, for a
callee the checker can name and no other kind. What must not happen is P1
being built against the *other* kind of callee: WP28 §7.4 measured a callee the checker cannot name at 1.26x for the
call and up to 8.76x for the escape proof it forfeits, and an intrinsic that
accepted one would spend the whole margin this page exists to buy.

---

## 7. What replaces the borrow checker, and what a worker may hand back

Rust's scoped threads are sound because the borrow checker proves the parent's
data outlives the scope. Nish has no borrow checker, and what it has instead is
narrower and, for this purpose, enough — because the arena is thread-local
(T0), which turns the lifetime question into a *locational* one:

> **A worker may write through a pointer the parent lent it, and may not
> allocate anything the parent will read.**

That single rule covers both stages. It is sound because a worker's allocations
live in the worker's own arena, which is freed when the thread exits, so a
pointer into it is dangling the moment the join returns — the same shape as
WP15 §7's `NL2290`/`NL2291` interior-pointer rule, and checkable the same way.
Its consequences, in the order they bite:

- **A worker's result type is a scalar** in the first version. `parallelMapInto`
  with a `U` that is a string or a class is rejected with a message that names
  the type, because the value would be in the wrong arena.
- **Results come back through memory the parent owns**, which is what
  `parallelMapInto`'s `dst` is and what makes the restriction above survivable
  rather than crippling: the numeric kernels where wp20 §8 measured 3.96x are
  exactly this shape.
- **Lifting the restriction is a copy at the join**, into the parent's arena,
  for a type whose size is known at the boundary. That is a later stage and it
  is where a `Channel<T>` of a non-scalar lands too, so the two want designing
  together.
- **The fourth escape flow finally has an owner.** wp20 §3.3 and wp24 §10 both
  named "escapes to another thread" as a class nobody was building. It is this
  rule, and P2 is where it lands.

---

## 8. Why data parallelism should be built before spawn

wp20's staging puts `parallelFor` last, as the payoff that the three stages
before it earn. Reversing that is this note's most actionable recommendation,
and there are four arguments, of which only the first is the measurement:

1. **The payoff is there and nowhere else.** wp20 §8: 3.96x on four cores for
   a compute kernel and 3.97x for an allocating one that recycles its arena,
   through the runtime partitioner that is now built. Nothing in T1 to T3
   produces a number at all — they produce the *ability* to produce one.
2. **It is the smallest stage, not the largest.** It needs no handle type, no
   join analysis, no `reject_thread_unjoined`, no `reject_thread_handle_escapes`,
   and no capture rule. What it needs is the runtime partitioner — **which has
   landed**, as `nish_parallel_range` in `runtime/runtime_parallel.c` (wp20
   §8d) — plus wp23 §6's known callee and the purity check the fixpoint already
   performs. T1 and T2 are strictly more machinery for strictly less measured
   benefit.
3. **It answers wp20 §4 T2's own request.** That section asks for the shareable
   rule to be "prototype[d] against a real program before committing to the
   surface". A `parallelMapInto` over a benchmark kernel *is* that program, and
   it exercises the rule in its narrowest form — one lent buffer, scalar
   results — where getting it wrong is cheap to correct.
4. **It is the form a user reaches for first.** Which is Go's lesson, arriving
   from the other direction: if the common case is not one line, the feature
   reads as expert-only.

The revised order, then: **P1 data parallelism, P2 the scope, P3 locks and
channels** — which is wp20's T4, T1, T3, with T2's shareable rule split across
P1 (its narrow form, one lent buffer) and P2 (its general form).

### 8a. One thing the compiler can do that neither Rust nor Go can

wp20 §8 measured that arena discipline in a parallel body is worth about **3x**
of wall clock and three orders of magnitude of peak memory — 1.37 GiB against
1.8 MB for the same source — independently of how many cores the region gets.
That is a fact about a program that this compiler can *see*: the
fixpoint knows whether the body allocates, and the `performance` diagnostic
class already exists (WP15 item 2, the `NL9xxx` band, `--json`,
`--no-warn-performance`).

So the surface should ship with a warning that neither Rayon nor a `go`
statement can give you. Note which case it is for: a body whose *result* is
allocated is already a compile error under §7, so what is left — and what a
real program does — is a body that returns a scalar and allocates a temporary
on the way there:

```
warning[NL9xxx]: the body of this `parallelMapInto` allocates per element
  --> src/index.ts:212:3
   = `scoreLine` returns i32 but allocates 1 string per call: about 3x of wall
     clock and 780x of peak resident memory against the same body with the
     arena recycled (measured, wp20 §8a)
   = rewrite: compute over the bytes in place, or `Arena.reset()` per chunk
     inside the body
```

It costs nothing to compute, it is the single most useful thing that can be
said about a parallel region before it is run, and it exists only because the
whole-program pass and the warning class were both built for other reasons.

**As built (NL9012).** The compiler went one step past the warning: rather than
telling the program to recycle the arena, it recycles it. A body that
allocates gets an arena scope of its own, so each element marks and releases
the arena of the thread it runs on, and the 780x of peak memory is not there to
warn about. What is left to say is that every element still pays for the
allocation and the release, and that is what the warning says, one line long,
at the call:

```
main.ts:23:3: performance: the body of this `parallelMapInto` allocates per element: `label` answers `i32` but allocates on every call, so each thread marks and releases its arena around every element. Compute the answer without building a string, an array or an object to save both
```

`Arena.reset()` inside the body is no longer the advice, and is refused
(NL2351): each thread has an arena of its own, and a body that moves it
could rewind past the mark its element scope is about to release to. The
warning honours `--no-warn-performance` and `--json` like every other.

**Measured**, on the four-core machine `docs/BENCHMARKS.md` names, by
`node bench/run.mjs` (the kernels are `bench/par_*.ts`, each one binary run as
the loop and as the map):

| kernel | loop | `parallelMapInto` | speedup |
| --- | ---: | ---: | ---: |
| `par_compute`: 64 square roots per element, 2^21 elements | 780 ms | 210 ms | **3.71x** |
| `par_nbody`: 1024 bodies, 16 steps, 3n probes per step | 171 ms | 49.0 ms | 3.49x |
| `par_alloc`: a string built and summed per element, 2^22 elements | 167 ms | 74.9 ms | 2.23x |
| `par_short`: an 8-element map, 2^20 calls | 54.7 ms | 56.1 ms | 0.97x |

Minimum of five runs after one warm-up. The compute kernel clears the 3x the
stage was held to. The allocating kernel's peak memory is 33,956 KB as the loop
and 34,596 KB as the map, which is its two arrays of 2^22 `i32` and nothing
else: the arena is recycled per element on every thread, where wp20 §8a's
unrecycled body held 1.37 GiB. It divides worse than the compute kernel
because each element is a bump, a format and a mark and release through the
thread-local arena rather than arithmetic.

The short map is the one where "no slower than the loop" is the claim, and
five runs cannot resolve 2.6%, so it was run 40 more times, interleaved with
the loop: 50.9 ms against 50.7 by minimum, 57.9 against 56.3 by median. Up to
its grain a map calls its chunk loop directly, which LLVM inlines, so what is
left is the per-call length check and two header reads the loop hoists out of
its caller; measured on a one-operation body (`(x * 3 + 1) % 1000003`) that
difference is about 3 ns per call, and on the four-operation body the kernel
uses it is within the noise. Before this stage, the same call cost an arena
mark and release (the wrapper's panic message was its own allocation) and an
indirect call through `nish_parallel_range`.

**The grain's calibration.** The estimate counts one unit per operation, 32
per allocation, 4 per call, and a loop body as many times as its literal bound
says, or 64 times when the bound is data. Against measured time per element
the unit runs from 0.07 ns (the allocating kernel, whose loop over a string's
bytes runs about 7 times and is estimated at 64) to 0.18 ns (the compute
kernel, 372 ns per element estimated at 2,060 units) and 1.6 ns (n-body,
whose inner loop over 1024 bodies is estimated at 64 trips). The target was
then set by the cheapest body there is, `(x) => x * 3 + 1` (5 units), at
exactly two chunks: with a target of 2^20 it lost 12% to the loop at 262,144
elements (60.8 ms against 54.1 over 400 maps), and with 2^22 it wins 1.54x at
1,677,722 (223.6 ms against 345.0). The default of 64 trips is what divides
n-body four ways: at 16, its 3,072 probes were two chunks.

---

## 9. Declined, with the rule each one breaks

- **A `go`-style detached spawn.** Needs a closure to be useful and an owner
  for the spawned work's memory after the spawning frame returns. wp20 §3.4
  defers detached threads and §1 refuses the growable stack that makes them
  cheap.
- **`Arc<T>`.** Atomic refcounting, for a need scoped threads remove. If
  detached threads ever arrive it arrives with them, not before.
- **`select` over channels.** A multi-way blocking receive has no closure-free
  spelling that is also legal TypeScript and also not a combinatorial family of
  `select2`, `select3`, ... Discriminated unions would give it one and they are
  deferred (WP15 item 8). Channels can ship without it; `select` should wait
  for a program that needs it.
- **A thread pool a program can configure.** A knob before a measurement. The
  partitioner picks `nish_cpu_count()` and caps at 64, and the scaling wp20 §8
  measured — within a few per cent of linear to four cores on all three
  kernels — is the measurement that would have to stop holding before a knob is
  worth its documentation.
- **`Atomic<T>` as the first escape hatch.** wp20 §6's argument stands: an
  escape hatch should be designed after the rule it escapes has met a real
  program. `AtomicI32` is in §10's declaration file to prove it is *spellable*,
  not to propose it for P1.
- **Decorators (`@parallel`) as the spelling.** Legal TypeScript, forbidden by
  Phase 0, and they decorate declarations rather than regions — so they could
  not mark the one thing that needs marking.
- **A `Thread` handle stored in a field, an array or a variable.** wp20 T1's
  rule, kept: it is what makes the `using` block's join a local fact instead of
  a whole-program one.
- **Async/await as the spelling for any of this.** wp28 §6 is where that
  question lives, it is sequenced behind this note by decision, and nothing
  here is designed to accommodate it beyond what §4.2 already is.

---

## 10. Appendix: the surface as a declaration file, and the program that typechecks it

Both files below were run through `tsc --strict` with `"lib": ["ES2022"]`,
`"module": "Node16"` and nothing else, and both come out clean. The
declaration file is what `nish/threads` would ship; the program uses every
construct this note proposes. The program imports it as `./threads.js` rather
than `nish/threads` only so that the `tsc` invocation below is self-contained —
resolution is WP21's and is not what this appendix is checking.

```ts
// `nish/threads`, the whole candidate surface. Self-contained: the disposable
// protocol is declared here rather than required from the consumer's `lib`, so
// a program using threads needs no tsconfig change.
declare global {
  interface SymbolConstructor {
    readonly dispose: unique symbol;
  }
  interface Disposable {
    [Symbol.dispose](): void;
  }
}

/** Data parallelism: the partition is the runtime's, so disjointness is a
 *  property of the call rather than a proof obligation. */
export declare function parallelMapInto<T, U>(src: readonly T[], dst: U[], f: (x: T) => U): void;
export declare function parallelReduce<T>(src: readonly T[], f: (acc: T, x: T) => T, identity: T): T;
/** Spellable, and deliberately not part of stage P1: a body that stores for
 *  itself hands the disjointness obligation back to the programmer (§4.1). */
export declare function parallelFor(lo: number, hi: number, body: (i: number) => void): void;

/** Structured spawn: Rust's scoped threads, joined by the block rather than by
 *  a proof that every path joined. */
export declare class ThreadScope {
  spawn<A>(entry: (arg: A) => void, arg: A): void;
  [Symbol.dispose](): void;
}
export declare function scope(): ThreadScope;

/** The lock owns what it protects, so there is no unguarded path to the data. */
export declare class Guard<T> {
  readonly value: T;
  [Symbol.dispose](): void;
}
export declare class Mutex<T> {
  constructor(value: T);
  lock(): Guard<T>;
}

export declare class AtomicI32 {
  constructor(value: number);
  add(delta: number): number;
  load(): number;
}
```

```ts
import { parallelMapInto, parallelReduce, parallelFor, scope, Mutex, AtomicI32 } from "./threads.js";

class Counter {
  n: number = 0;
}

const square = (x: number): number => x * x;

function shard(id: number): void {
  const local = id * 2;
  sink = sink + local;
}

let sink = 0;

export function main(): number {
  // 1. data parallelism, body written at the call site
  const src: readonly number[] = [1, 2, 3, 4];
  const dst: number[] = [0, 0, 0, 0];
  parallelMapInto(src, dst, (x) => x * 3);
  // ... or by name
  parallelMapInto(src, dst, square);
  const total = parallelReduce(src, (a, b) => a + b, 0);
  parallelFor(0, 100, (i) => {
    sink = sink + i;
  });

  // 2. structured spawn, joined by the block
  {
    using s = scope();
    s.spawn(shard, 1);
    s.spawn(shard, 2);
  }

  // 3. a lock that owns its data, unlocked by the block
  const m = new Mutex<Counter>(new Counter());
  for (let i = 0; i < 4; i++) {
    using g = m.lock();
    g.value.n = g.value.n + 1;
  }

  const a = new AtomicI32(0);
  a.add(1);
  return total + a.load() + dst[0] + sink;
}
```

```bash
tsc --noEmit --strict --lib ES2022 --module Node16 --moduleResolution Node16 \
    threads.d.ts prog.ts
# exit 0
```

Note what the program is *not*: it is not a Nish program yet. `parallelMapInto`
needs §6's known callee, `using` needs the rule split §5 describes, and none of
the intrinsics exist. What the exit code establishes is the thing this note had
to establish before designing anything — that the surface is sayable in the
language Nish is a subset of.

## 11. Open

- ~~**Whether `parallelReduce` needs an identity argument or an initial value.**~~
  **Closed by P1: an identity, and a deterministic blocking.** `src` is split
  into `min(64, ceil(n / 2^20))` blocks, each folded from the identity, and the
  block results combined left to right; `std/threads.ts` does the same blocking
  on one thread, so the answer is the same bits on any core count, compiled or
  under Node. The rule for a plainly non-associative body is to refuse it when
  it can be read: an arrow whose whole body is `-`, `/`, `%`, `**` or a shift
  on its two parameters, and a recognised operator given a literal that is not
  its identity. A named function is opaque, and LANGUAGE.md says the obligation
  is its author's.
- **Whether `scope()` should take the thread count.** It reads like a knob and
  §9 declines knobs before measurements, but a scope with three spawns and four
  cores is a different shape from `parallelFor`.
- **What a `Channel<T>` of a non-scalar costs**, which is §7's copy-at-join
  question and the reason channels and non-scalar results should be designed in
  one go rather than separately.
- **Whether `using` should be admitted in strict at all, or only alongside the
  threads surface.** This has no deadline: on 0.x any minor may change the
  language, and after 1.0 the rule at the head of LANGUAGE.md still lets a
  minor turn a refusal into an acceptance. That also settles which way to err:
  the narrow answer — `using` is accepted only for the types the threads module
  declares — can be widened later without a break, and the wide one could only
  be narrowed by one. It still makes `using` a keyword that works on two
  types, which is an odd thing to write down.
- **Whether the partitioner belongs in the runtime or in emitted IR.** T0's
  arena went into the C, but a partition loop is code the optimiser would like
  to see. It is the kind of question wp7's budget rule (§2 of MASTER_PLAN)
  decides, and nobody has costed it.
