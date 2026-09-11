# WP20: Threads

**Proposed, not implemented.** Nothing in this note exists in the compiler
today; it is the plan of record for the question "how does Nish do true
multithreading, like Go or Rust", and the shape of the answer is forced by
decisions the project has already made rather than chosen freely. The
normative rules would land in [LANGUAGE.md](LANGUAGE.md) as each stage does;
where this note and LANGUAGE.md ever disagree, LANGUAGE.md wins.

Read [wp6-memory.md](wp6-memory.md) first: every hard part below is a
consequence of the zero-GC memory model, and §3 here is mostly a list of
places where a WP6 guarantee stops holding once a second thread exists.

## 1. The decision

**1:1 OS threads, with data races rejected at compile time. Not goroutines,
and not Go's runtime-detector posture.**

Two independent arguments land on the same answer, and neither is a
preference.

### Goroutines need a moving stack, and a moving stack needs a GC

Green threads are cheap because the runtime can grow a stack by relocating it,
and it can relocate a stack because a precise garbage collector knows which
words in the frame are pointers. Nish's first vision bullet is zero GC
(MASTER_PLAN §1), and WP6 spends that budget immediately: an allocation site
whose value provably does not outlive its function becomes an entry-block
`alloca`, and a site inside a loop is allocated *once* with the slot reused on
every iteration ([wp6-memory.md](wp6-memory.md) §1). The soundness argument
for both is that nothing outside the frame can name the object. Relocating
the frame is precisely the operation that argument does not survive.

So frames are fixed, stacks are the platform's, and a thread is an OS thread.
M:N scheduling is not a later optimisation of this design; it is a different
design with a different memory model underneath it.

### Go's tolerance for races is not available to this compiler

Go treats a data race as a bug you find with a detector at runtime.
Nish cannot, because it has already spent the assumption such a
detector would have to preserve. `src/codegen/attributes.ts` emits `readnone`,
`readonly` and the pointer-parameter facts only where a fixpoint over the
whole program's call graph proves them, and the rule is that a wrong attribute
is undefined behaviour rather than a missed optimisation
(ARCHITECTURE.md, "Attribute soundness rules"). Every one of those proofs
assumes a single mutator. A language that permits unsynchronised
shared mutation makes them false, and a false LLVM attribute is undefined
behaviour — the failure is silent miscompilation of correct-looking code, not
a race report.

There is no middle position here. **Either the checker rejects data races
statically, or the attribute fixpoint has to be given up.** Giving it up
costs most of what WP9 and WP15 bought. So: the Rust answer.

## 2. What the language already gives us

Unusually much, and all of it by accident of other decisions.

| Asset | Where it comes from | What it buys |
| --- | --- | --- |
| **No mutable global state, at all** | top-level `let` is rejected (`reject_const_top_level_let`), static class fields are rejected (`reject_cls_static`), top-level statements are rejected (`reject_top_level_stmt`), and a module `const` emits no symbol — it folds into the IR (LANGUAGE.md, "Module constants") | The largest category of shared-mutable-state bug in C and half of it in Go cannot be written. Everything two threads can both reach arrived through a pointer somebody passed, which is exactly the thing an analysis can follow. |
| **No closures** | function expressions and arrow functions are rejected (LANGUAGE.md, "Functions"); there is no function type in the type table | A thread entry can only be a named top-level function. The "what did the closure capture, and who owns it after the spawning frame returns" problem — which costs Rust `move` plus `Send` bounds and costs Go a GC — does not arise. |
| **A whole-program compiler with the analysis already in the right shape** | `Compilation` loads every import transitively and runs `src/codegen/attributes.ts` over all modules at once; `src/codegen/escape.ts` already classifies each allocation site as `local` / `returned` / `leaks`, and the `pointerParams` / `escaping` fixpoints already answer "does this callee capture this pointer" | A `Send`-shaped judgment is the same fixpoint with one new flow class, not a new subsystem. This is why §4 does not propose a trait system: with the whole program in hand, one is not needed for the cases threads care about. |
| **Immutability that is already checked** | strings are immutable, shared by pointer and never individually freed; `readonly T[]` is a checker-enforced promise of no store, no `push`, no `pop`, and no widening back (LANGUAGE.md, "Readonly arrays") | The shareable-type set of §4 T2 is not built from nothing. Strings and `readonly` arrays of shareable elements are safe to share the day the arena question is settled. |
| **Nothing unwinds** | functions are `nounwind`; a failure is a `Result` and `throw` is gone (WP16) | A thread trampoline has one exit and no cleanup path. Compare the care a language with exceptions needs at a thread boundary. |
| **Two targets already separated** | `runtime/runtime.c` and the freestanding `runtime/runtime_wasm.c` | The wasm story (§6) can be deferred without a fork, because the split already exists. |

## 3. What blocks it, in the order it bites

### 3.1 The arena is one global, and the bump is inlined into the IR

`struct nish_arena nish_arena;` is a single process-wide object
(`runtime/runtime.c:35`, `runtime/nish.h`), and — the sharp part — the fast
path is not a call. `inlineAllocator()` (`src/codegen/runtime.ts:385`) emits
an `alwaysinline` function that GEPs into `@nish_arena` and does a plain
non-atomic `load` / `add` / `store` on the bump offset, and every `new`,
object literal, array literal, string concatenation and template with a hole
goes through it.

Two threads allocating is therefore a data race **in the emitted IR**, not
merely in the C runtime. It cannot be fixed in `runtime.c` alone.

The fix is a thread-local arena: `@nish_arena` becomes `thread_local`, the
allocator's GEPs go through it, and each thread bumps its own chunks. That
touches the ABI (`%struct.nish_arena` in `src/codegen/runtime.ts` and
`runtime/nish.h` and `runtime/runtime.c`, which change together by rule 4 of
the orientation), and it rewrites the allocator prologue in the golden `.ll`
of every test that allocates. The exact IR spelling — a `thread_local`
global referenced directly, or `@llvm.threadlocal.address` — is for T0 to pin
against LLVM 18 rather than for this note to guess.

Cost: with the initial-exec model in a linked executable this is about one
extra register on the hot path, and `-fPIC` shared objects are worse. That is
a benchmark question, not an argument, which is why T0 stands alone and is
gated on [BENCHMARKS.md](BENCHMARKS.md).

`nish_arena_mark` / `nish_arena_release` / `nish_arena_keep` become
per-thread and get *better*, not worse: WP6's automatic scopes and WP9's
call-site reclaim are per-thread by construction, so a worker that allocates
and returns leaves the parent's arena untouched.

### 3.2 The other runtime globals

`static uint64_t nish_rng` (`runtime/runtime.c:222`) is mutable process-wide
state, so `Math.random()` from two threads is a race today; it becomes
thread-local with a per-thread seed, which also makes a parallel program's
random stream reproducible per worker instead of interleaved. `nish_argv`
(`runtime/runtime.c:284`) is written once by `nish_argv_init` before `main`
runs and read-only afterwards, so it is safe as it stands provided no thread
is spawned before initialisation — a fact worth writing down rather than
relying on.

### 3.3 Per-thread arenas make lifetime a new question

Today an object's lifetime is bounded by a frame: WP6 proves a value does not
outlive its function and puts it on the stack or inside a scope that releases
it. A spawned thread can outlive the frame that spawned it, and a pointer
bumped on thread A is reclaimed by A's `nish_arena_release` while B may still
hold it. Neither the stack rule nor the scope rule is sound across a spawn
without a new fact.

`src/codegen/escape.ts` therefore needs a fourth flow beside `local`,
`returned` and `leaks`: **escapes to another thread**. A site with that flow
is barred from an `alloca` and from a scope-bracketed region, exactly as
`leaks` bars it from the stack today.

### 3.4 Structured threads are sound much more cheaply than detached ones

If a `join` is proven to happen before the spawning frame's arena release,
then the parent frame outlives every child and a child may borrow the
parent's data freely — the join sits *inside* the bracket WP6 already emits.
This is Rust's `std::thread::scope`, and it composes with the existing memory
model instead of arguing with it.

Detached threads need an owned transfer instead, and there are only two
honest ways to get one: copy the message graph into the receiver's arena at
the boundary, or add opt-in atomic reference counting — which MASTER_PLAN §3.4
already carries as an open decision ("RC opt-in per class") and which is a
work package in its own right. **Structured first; detached is not in this
plan.**

### 3.5 The runtime budget

`runtime.c` is under a hard budget of 4 KB of `.text` at `-Oz`, and stands at
2,544 today (MASTER_PLAN §2). `pthread_create`, a mutex and a condition
variable do not fit inside the remaining 1,552 bytes as unconditional cost,
and threads also add `-lpthread` to the link line.

They must therefore be pay-for-what-you-use, exactly as WP14's `nish_mkdir`
and `nish_spawn` are: adding them left `examples/hello.ts` at 4,696 bytes,
the same number to the byte, because `-ffunction-sections -Wl,--gc-sections`
means a program pays only for the functions it calls. A program that never
spawns must keep paying nothing, and that is an acceptance test, not a hope.

### 3.6 Every rule lands twice

`src/` and `self/` mirror each other construct for construct, and stage1 must
still compile itself to a byte-identical fixed point
([selfhost.md](../.claude/selfhost.md), [wp14-selfhost.md](wp14-selfhost.md)).
A new flow class in escape analysis, a new statement form and a new family of
diagnostics are each two implementations, two dispatch entries and a
bootstrap that has to close. The diagnostic-code registry is generated, and
`npm test` fails while it is stale.

This is the single largest multiplier on every estimate below.

## 4. The staged plan

Five stages. Each is separately useful, separately gated, and — apart from
T0, which has no language surface — separately documentable in LANGUAGE.md.

### T0 — A thread-safe runtime, with no language surface

Thread-local arena (§3.1) and thread-local RNG (§3.2), behind `--threads` so
the golden corpus does not churn before the numbers justify it.

- No new syntax, no new diagnostics, nothing a program can observe except
  through the flag.
- Acceptance: the whole suite green with the flag on and off; the benchmark
  table (`node bench/run.mjs`) unchanged within noise with the flag *off*, and
  the with-flag cost measured and written down rather than assumed;
  `examples/hello.ts` the same size to the byte with the flag off.
- This is the prerequisite for every other stage, and for the detached-thread
  designs §3.4 defers as well, so it is worth landing on its own merits even
  if the rest of this note is never built.

### T1 — Structured spawn and join

The minimum surface, and the only one that is sound under WP6 without new
lifetime machinery:

```ts
const h: Thread = Thread.spawn(worker, arg);   // worker is a top-level function
const status: i32 = h.join();
```

The checker enforces three things:

1. **The entry is a named top-level function.** Free — there are no closures
   and no function values to pass instead.
2. **Every handle is joined on every path** of the frame that spawned it, and
   the join is inside that frame's arena scope. "On every path" is the same
   proof shape as the definite-return analysis behind
   `reject_missing_return`, over the same CFG.
3. **The argument type is shareable**, per T2.

A handle is not storable in a field, an element or an array in this stage:
that is the rule that keeps (2) a local proof rather than a whole-program one.

### T2 — The shareable-type rule: `Send`/`Sync` without traits

What may cross a spawn boundary:

- scalars (`number`, `i32`, `i64`, `f64`, the unsigned widths, `boolean`);
- `string` — immutable, shared by pointer, and outlived by the parent frame
  under T1's structure;
- `readonly T[]` where `T` is shareable — the no-store promise already exists
  and is already checked;
- a class or interface all of whose fields are shareable **and** which the
  whole-program fixpoint proves is not mutated after the spawn point, reusing
  the machinery §2 describes.

Everything else is a compile error with a stable code, in the house style:
a mutable array, a class the fixpoint cannot clear, a nullable that has not
been narrowed, a `Thread` handle.

This is where a trait system would go in Rust and where it is not needed
here, because the compiler sees every module at once. It is also the stage
that decides how much real work is expressible, so it is the one to prototype
against a real program before committing to the surface.

### T3 — Channels and mutexes

The only way to move *mutable* data between threads, and the stage that says
what a program does when structured borrowing is not enough.

**This wants monomorphisation first.** A channel of `T` without generics
means one builtin per element type, which is the corner `Array<T>` and
`Result<T, E>` already sit in as built-ins rather than library code
([wp18-generics.md](wp18-generics.md) §6.1 explains why they are allowed to).
Adding a third such family by hand would be a decision to regret; WP15 item 8
is the prerequisite, and this note does not try to route around it.

### T4 — Data parallelism, which is the point

A `parallelFor`-shaped intrinsic over a `readonly` slice: the work partitioned
by the runtime, the body a top-level function, the shareable rule of T2 doing
the safety argument with nothing new.

This is where the measurable payoff is. Of the seven programs in
[BENCHMARKS.md](BENCHMARKS.md), `nbody` (1.22x behind Rust) and `spectral`
(1.12x) are exactly this shape, and a four-core machine changes those numbers
by more than any single-thread item on the WP15 list can. That is the
argument for the whole package, and it should be measured on a prototype
before T1 is designed rather than after T4 is built.

## 5. Diagnostics

Each stage adds a family, generated into `src/codes.ts` / `self/codes.ts` by
`scripts/gen-diagnostic-codes.mjs` like every other. The shape, in the
existing voice:

| Rule | Message | Case |
| --- | --- | --- |
| the entry must be a named top-level function | `` The first argument of `Thread.spawn` must be a top-level function `` | `reject_thread_entry_not_function` |
| a handle must be joined on every path | `` `h` must be joined on every path before `run` returns `` | `reject_thread_unjoined` |
| a handle does not escape its frame | `` A `Thread` cannot be stored in a field, an element, or an array `` | `reject_thread_handle_escapes` |
| the argument must be shareable | `` Cannot share `Buffer` across a thread: field `items` is a mutable array `` | `reject_thread_arg_not_shareable` |
| an allocation reachable from a spawn is not stackable | (no user-facing message; a WP6 fact, visible in `--dump`) | `mem_thread_no_stack` |

The fourth is the one that has to be *good*, in the way Rust's `Send` errors
had to be good: it is the diagnostic a user meets while learning the model,
and it must name the field that disqualified the type rather than the type.

## 6. Not in this plan

- **wasm threads.** Shared memory plus the `atomics` and `bulk-memory`
  features, per-thread regions carved out of `runtime_wasm.c`'s
  arena-over-linear-memory, and workers on the JavaScript side. Deferred past
  all five stages; the runtime split already exists, so deferring costs
  nothing structurally.
- **Detached threads**, per §3.4, and the atomic refcounting they would need.
- **Async/await.** `async` and `await` are forbidden constructs with their own
  Phase 0 rules and no event loop behind them (LANGUAGE.md). Threads do not
  change that and this note does not propose to.
  [wp24-async.md](wp24-async.md) is the plan of record for the question, and it
  reaches the same answer from the other side: the I/O surface is synchronous
  and there is nothing to await, so what an asker usually wants is T0 plus an
  asynchronous N-API export, and the rest is this note's T1 to T4.
- **A race detector.** §1 explains why the static rule replaces it rather
  than complementing it.
- **Atomics as a user-facing type.** They would be the escape hatch from T2,
  and an escape hatch should be designed after the rule it escapes has met a
  real program.

## 7. Sequencing

Two questions this note deliberately does not answer alone, because they are
scheduling decisions rather than design ones.

**Before or after the 1.0 freeze?** M4 is the only milestone left and it
freezes the language reference (MASTER_PLAN §9). T1 through T4 each add rules
to LANGUAGE.md, so the package is either pre-freeze scope — which delays 1.0
by a large multiple of §3.6 — or it is 1.1, which is the honest default.

**T0 is separable and probably should be early regardless.** It has no
language surface, it is a prerequisite for every version of this design
including the detached-thread ones §3.4 defers, and its whole cost is a
benchmark question
that can be answered in a day. Nothing about the 1.0 freeze argues against
it.

The suggested order, then: **T0 whenever it is convenient; a T4-shaped
prototype to measure the payoff before the surface is designed; T1 and T2
together after the freeze; T3 after WP15 item 8.**
