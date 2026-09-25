# WP20: Threads

**T0 is built, and so is the partitioner under T4 —
`runtime/runtime_parallel.c`, which has no language surface and costs a program
that does not use it nothing, byte for byte (§8d). T1 to T4's *language*
surface is proposed, not implemented, and
[wp29-thread-surface.md](wp29-thread-surface.md) is what it is.** The payoff T4
was waiting to be measured against is measured (§8): **3.96x** on four cores
for a compute kernel, **3.09x** for an allocating one and **3.97x** for the
same allocating one with its arena recycled — and arena discipline is worth
another ~3x on top, so the two multipliers compose to **12x** against a naive
single-threaded build. Fix the body, then add threads. §8b is the correction of
an earlier, worse measurement taken on an ad-hoc driver, kept visible rather
than folded in. This is the plan of
record for the question "how does Nish do true multithreading, like Go or
Rust", and the shape of the answer is forced by decisions the project has
already made rather than chosen freely. The normative rules would land in
[LANGUAGE.md](LANGUAGE.md) as each stage does — except T0, which has no rule to
add, because it has no language surface: §4 T0 below records what landed. Where
this note and LANGUAGE.md ever disagree, LANGUAGE.md wins.

[wp29-thread-surface.md](wp29-thread-surface.md) is the companion note and
answers the question this one leaves open — *what the surface actually is,
given that it has to be legal TypeScript*. It proposes Rust's scoped threads
spelled with `using`, a `Mutex<T>` that owns its data, Rayon-shaped data
parallelism, and reversing the stage order below so that the data-parallel
intrinsic comes first; the whole surface was run through `tsc --strict` before
being proposed. Where it and this note differ on a stage's contents, it is the
later document and it wins; where either differs from LANGUAGE.md, LANGUAGE.md
wins.

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
| **No closures** | a function is declared as an arrow bound to a module-level `const`, and the `function` keyword is the legacy spelling of the same thing; but a function is still not a value — a name bound to one may only be called, so `const alias = double` is `` Unknown identifier `double` `` (`reject_arrow_as_value`). An arrow anywhere else is `Unsupported expression in Phase 1: ArrowFunction`, nested function declarations are rejected, and there is no function type in the type table (`reject_function_type`) (LANGUAGE.md, "Functions") | A thread entry can only be a named top-level function. The "what did the closure capture, and who owns it after the spawning frame returns" problem — which costs Rust `move` plus `Send` bounds and costs Go a GC — does not arise. |
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

**This is what landed, and §4 T0 has the numbers.** Two of the three guesses
in the paragraph above were wrong, both in the cheap direction. The spelling is
a `thread_local(initialexec)` global *referenced directly*: LLVM 18 takes it in
the GEP operand of the allocator and needs no `@llvm.threadlocal.address`. And
the allocator's body does not change at all — the only line that moves is the
`@nish_arena` declaration, and only in a module compiled with `--threads`, so
no golden was rewritten. The third guess held: one extra register.

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

Both landed with T0. `nish_rng` is `_Thread_local` under `-DNISH_THREADS`, and
`nish_argv` is deliberately not, with the reason written beside it in
`runtime/runtime.c` so that the next reader does not "fix" the inconsistency.
One thing the note promised and T0 does not deliver: the per-thread stream is
*independent*, not *distinct*. Both threads seed lazily from `time(0)` and the
pid, so two workers starting in the same second start from the same seed and
draw the same numbers. Nothing tears, which was the point; a program that wants
different streams per worker has to seed them itself, and there is no API for
that yet.

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

`runtime.c` was under a hard budget of 4 KB of `.text` at `-Oz` when this note
was written, and stood at 2,544 then (MASTER_PLAN §2). The live ceilings are
two, one per translation unit and each counted over every `.text*` section:
3,584 bytes for the core `runtime.c` and 1,280 for `runtime_os.c`, the half
whose subject is the operating system — which is the half a thread API would
land in. `docs/wp7-runtime.md` §"Runtime additions and budget" carries both and
the current measurements. `pthread_create`, a mutex and a condition variable do
not fit inside the remaining 1,552 bytes as unconditional cost, and threads also
add `-lpthread` to the link line.

The remaining headroom is 194 bytes, not 1,552, and T0 spent none of it: the
default build is unchanged to the byte, because `NISH_TLS` is empty without
`-DNISH_THREADS`. The thread-local build spends 125 of those bytes on the
thread pointer and comes to 4,795, still inside the ceiling but with 69 bytes
left rather than 194 — so the build T1 extends starts nearer the wall than the
default one does, and `pthread_create` is not going to fit in it either.

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

### T0 — A thread-safe runtime, with no language surface — **done**

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

#### What it turned out to be

Smaller than this note expected, and in one sentence: **one declaration line in
the IR and one storage class in the C.**

```llvm
; without --threads
@nish_arena = external global %struct.nish_arena, align 8
; with
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8
```

Nothing else in a module moves — `@nish_alloc_struct` GEPs the declaration it is
given and LLVM 18 accepts a thread-local global straight in the GEP operand, so
the `alwaysinline` body is the same text either way and `@llvm.threadlocal.address`
is not needed. On x86-64 the fast path becomes one `movq nish_arena@GOTTPOFF(%rip)`
and then `%fs`-relative addressing for all three fields: the extra register §3.1
predicted, and no call. `initialexec` is named rather than left to default
precisely so that the `-fPIC` case (the `napi` profile, which is the one host
that will want this — [wp24-async.md](wp24-async.md) §5.1) does not lower an
allocation to `__tls_get_addr`. The price of naming it is that a `dlopen`ed
object spends from glibc's static TLS surplus rather than allocating on demand;
40 bytes of arena and seed is far inside it, and an addon built this way was
checked to `require()` into Node and answer correctly.

On the C side `runtime/runtime.c`, `runtime/nish.h` and `runtime/runtime_wasm.c`
each define the same `NISH_TLS` macro, empty unless `-DNISH_THREADS`, and it
sits on `nish_arena` and on the RNG seed. `nish_argv` deliberately does not have
it (§3.2). `scripts/build.sh --threads` passes the macro, and
`nish --threads --link` passes the flag, so the two halves of a build move
together — and cannot silently fail to: ELF refuses a non-TLS reference to a TLS
definition, so a mismatched pair is a link error, which `tests/run.js` pins as a
check of its own rather than leaving to luck.

#### What it cost, measured

| | without `--threads` | with |
| --- | ---: | ---: |
| `runtime.c` `.text*` at `-Oz` (budget 4,864) | **4,670**, unchanged to the byte | 4,795 |
| `examples/hello.ts`, size profile | **4,680**, byte-identical to before | 4,808 |
| an allocation-bound loop (4M scopes × 64 escaping objects) | 451 ms | 667 ms (**1.48x**) |
| `bench/strbuild` at 4M pieces | 829 ms | 824 ms (noise) |
| `bench/nbody` | 974 ms | 1,006 ms (1.03x, noise) |

Times are the best of seven runs, the two variants interleaved run by run so
that a busy patch of machine hits both — the absolute numbers are therefore not
[BENCHMARKS.md](BENCHMARKS.md)'s and are not meant to be, only the ratios in
each row are. The two allocation-heavy benchmarks are the interesting rows and
they say opposite things, which is the point. **The thread pointer costs about
half again on a loop that does nothing but bump**, and nothing at all on real
programs, because
no real program's hot loop is the allocator — `strbuild` spends its time in
`memcpy` and `nbody` in arithmetic on stack slots WP6 already took out of the
arena. So the honest summary is that the flag is free for the programs in
[BENCHMARKS.md](BENCHMARKS.md) and expensive for a microbenchmark of the thing
it changes, and that is why it is a flag: a program pays only if it asks.

With the flag *off*, nothing moved. Not one golden `.ll` changed, the runtime's
`.text` is the same number, and `hello` is the same binary byte for byte — which
is what the `--threads` default of `false` buys and what made it landable
without waiting on the rest of the package.

The budget rule of [wp15-performance.md](wp15-performance.md) §7 is therefore
not called on and neither is the gate. `RUNTIME_TEXT_BUDGET` in `tests/run.js`
sums every `.text*` section of `clang -Oz -c runtime/runtime.c` against a
ceiling of 4,864 ([wp7-runtime.md](wp7-runtime.md) §"Runtime additions and
budget"), and that build — the one a user's `--link` produces — did not move a
byte. The `-DNISH_THREADS` build costs 125 bytes more and is inside the ceiling
too, at 4,795; it is not what the gate measures, because it is a configuration
nobody links without asking for it, but it is worth writing down for T1, which
arrives with `pthread_create` beside it and has 69 bytes rather than 194 to fit
it into (§3.5).

#### What it did not buy

- **No thread can be started yet**, and nothing in the language will start one,
  so no Nish program alone can observe the flag. What it enables is a *host*
  starting one: a C driver, or the `napi_create_async_work` shim
  [wp24-async.md](wp24-async.md) §5.1 wants, which was the whole cost of that
  item and is now unblocked.
- **No escape rule.** §3.3's fourth flow class — an allocation that escapes to
  another thread — is not implemented and does not need to be until something
  can spawn. Until T1, an object crossing a thread boundary is the host's
  problem, exactly as a raw pointer handed to C has always been.
- **Nothing for wasm.** `runtime_wasm.c` mirrors the macro so a `--threads`
  build still links, but a wasm module has one thread and `_Thread_local` in a
  non-shared memory is one ordinary block of linear memory. §6 still defers
  wasm threads in full.
- **Not a distinct random stream per thread**, only an untorn one; see §3.2.

Tests: `tests/cases/mem_threads_arena` (the golden that pins the declaration
and the output), the `-DNISH_THREADS` half of `tests/runtime_test.c` (a worker
thread's arena is its own, empty at entry, disjoint, and released without the
parent losing a byte), and three pipeline checks in `tests/run.js` — the
thread-local allocator linking and running on two threads through
`scripts/build.sh --threads`, the mismatched link failing, and `NISH_TLS` being
spelled the same way in all three runtime files.

### T1 — Structured spawn and join

**The surface below has been superseded by
[wp29-thread-surface.md](wp29-thread-surface.md) §4.2**, which keeps every rule
in this stage and changes the spelling: a scope introduced by `using` rather
than a handle with a `join()` call, so that rule 2 is emitted by the construct
instead of proved by an analysis. What follows is the original design and the
three rules, which wp29 inherits unchanged.

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
[wp29-thread-surface.md](wp29-thread-surface.md) §4.1 is the surface, and its
§8 argues — on this section's own measurement — that this stage should be built
**first** rather than last, because it is the smallest of the four as well as
the only one with a number attached.

This is where the measurable payoff is. Of the seven programs in
[BENCHMARKS.md](BENCHMARKS.md), `nbody` (1.22x behind Rust) and `spectral`
(1.12x) are exactly this shape, and a four-core machine changes those numbers
by more than any single-thread item on the WP15 list can. That is the
argument for the whole package, and this note asked for it to be measured on a
prototype before T1 is designed rather than after T4 is built.

**That prototype has been run, twice, and §8 is what it said.** In one line:
**3.96x** on four cores for a compute kernel and **3.97x** for an allocating
one whose arena is recycled, against a WP15 list whose largest remaining
single-thread item is worth 2.48x and whose typical one is worth a few per
cent. The payoff is real and it is the largest number left anywhere in the
plan. The partitioner itself is built (§8d); what remains in this stage is the
language surface, which is wp29's.

What the measurement also said is that arena discipline in the body is worth
about 3x *independently* of the cores, and three orders of magnitude of peak
memory — so T4 wants an arena story beside its partitioning story, on memory
rather than on scaling. §8b is the correction: an earlier draft of this section
reported the recycled kernel at 1.86x and built a scaling argument on it, and
the driver rather than the workload was the limiter.

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
  change that and this note does not propose to. What has changed since is the
  direction the question can be asked from:
  [wp28-compatibility-mode.md](wp28-compatibility-mode.md) §6 proposes that a
  *ported* `await` be lowered onto this note's T1 and T2 rather than onto an
  event loop, which makes the keyword a spelling of spawn-and-join rather than
  a concurrency model of its own. That is downstream of T1 and T2 by decision
  (§7), so nothing in it moves a rule here.
  [wp24-async.md](wp24-async.md) is the plan of record for the question, and it
  reaches the same answer from the other side: the I/O surface is synchronous
  and there is nothing to await, so what an asker usually wants is T0 plus an
  asynchronous N-API export, and the rest is this note's T1 to T4. That export
  is built on top of T0 — `--emit-napi-async`, wp24 §5.1 — which makes T0 the
  first row of this table to have a customer outside it.
- **A race detector.** §1 explains why the static rule replaces it rather
  than complementing it.
- **Atomics as a user-facing type.** They would be the escape hatch from T2,
  and an escape hatch should be designed after the rule it escapes has met a
  real program.

## 7. Sequencing

Two questions this note deliberately does not answer alone, because they are
scheduling decisions rather than design ones.

**Before or after 1.0?** Neither constrains it. The project stays on 0.x until
its owner declares 1.0, and T1 through T4 each add rules to LANGUAGE.md, which
any release may do. **It is next**: [MASTER_PLAN](MASTER_PLAN.md#what-remains)
names the data-parallel call as the next item.

**T0 is separable and probably should be early regardless.** It has no
language surface, it is a prerequisite for every version of this design
including the detached-thread ones §3.4 defers, and its whole cost is a
benchmark question
that can be answered in a day. Nothing about 1.0 argues against
it. **It landed on that argument** — the benchmark question is answered in §4
T0, and the answer was "nothing, unless the program asks".

The remaining order, as this note first wrote it: **T1 and T2 together after
the freeze; T3 after WP15 item 8** — except that [wp29-thread-surface.md](wp29-thread-surface.md) §8
argues for reversing it, on the strength of §8 below: data parallelism first
because it is where the payoff is *and* because it is the only stage needing no
handle, no join proof and no capture rule, then the scope, then locks and
channels. That is T4, T1, T3, with T2's shareable rule split between the first
two. This note does not overrule its companion; the order above is what it said
before the measurement existed. The T4-shaped prototype that used to open that sentence has been run
(§8), so the measurement it was gating no longer gates anything: T1 is designed
against 3.76x rather than against a prediction. Nothing else in the order
changed when T0 landed, and the one thing T0 unblocks outside this note is
[wp24-async.md](wp24-async.md) §5.1's A1, which is built.

One thing has been *added* to the order since, from the other end. WP28's
compatibility dialect ([wp28-compatibility-mode.md](wp28-compatibility-mode.md)
§6) proposes `async`/`await` as notation that a flag re-targets, and its
`--async-model threads` lowering — `Promise.all` over non-interfering calls
becoming a real fork and join — is this note's T1 and T2 wearing a JavaScript
spelling. **Threads come first, and the decision is recorded here rather than
only there**: the engine is built as `Thread.spawn` / `join` and a
`parallelFor`, with its own surface and its own diagnostics, and only then is
it something a ported `await` can be lowered onto. Building the notation first
would mean designing T2's shareable-type rule through a keyword that hides it,
which is the opposite of the order §4 T2 asks for — "the stage that decides how
much real work is expressible, so it is the one to prototype against a real
program before committing to the surface".

## 8. The T4 payoff, measured

§4 T4 and §7 both asked for this before T1's surface was designed. It has been
measured twice: first on an ad-hoc pthreads driver, and then again through
`runtime/runtime_parallel.c`, the runtime entry point that landed as the stage
under [wp29-thread-surface.md](wp29-thread-surface.md)'s surface. **The second
measurement corrected the first**, and §8c is that correction written out
rather than quietly folded in, because the first is what this note said for a
while and a reader deserves to know which number was wrong.

Nothing in the language spawns a thread, so the programs are what T0 and the
partitioner make possible and no more: three kernels compiled to the C ABI by
the ordinary compiler, and a C driver that calls `nish_parallel_range` over one
**fixed** amount of work, asking for a given number of chunks, so the chunk
count is the only variable and every row below comes from one binary. The
programs are in §9; the machine is four physical cores of an Intel Xeon at
2.80 GHz with 16 GB, no SMT and no cgroup CPU quota, in a container — which
puts a hard ceiling of 4x on every row and leaves what a larger machine does
unmeasured. Best of five per cell. The absolute numbers are this box's and are
not [BENCHMARKS.md](BENCHMARKS.md)'s; only the ratios mean anything.

| Kernel | 1 chunk | 2 | 4 | at 4 |
| --- | ---: | ---: | ---: | ---: |
| arithmetic — a hash chain over a range, no allocation | 977 ms | 489 ms | 247 ms | **3.96x** |
| allocating — one 8-byte object per iteration, arena left to grow | 1,323 ms | 744 ms | 428 ms | **3.09x** |
| the same, with `Arena.reset()` every 4,096 objects | 437 ms | 216 ms | 110 ms | **3.97x** |

Two kernels at essentially the ceiling and one at three quarters of it. And the
other half of the question, because a thread-local arena is not free and T0
measured 1.48x for it on a pure-bump microbenchmark — the same kernels built
*without* `--threads` and run on one chunk, interleaved against the `--threads`
build:

| Kernel, one chunk | without `--threads` | with | cost |
| --- | ---: | ---: | ---: |
| arithmetic | 983 ms | 979 ms | none (noise) |
| allocating, arena grows | 1,289 ms | 1,422 ms | **1.10x** |
| allocating, arena recycled | 305 ms | 372 ms | **1.22x** |

### 8a. The two multipliers compose, and that is the useful result

Arena discipline and cores are independent, and a program gets the product:

| | arena grows | arena recycled | discipline is worth |
| --- | ---: | ---: | ---: |
| 1 chunk | 1,323 ms | 437 ms | **3.03x** |
| 4 chunks | 428 ms | 110 ms | **3.89x** |
| **cores are worth** | **3.09x** | **3.97x** | |

So the best configuration measured beats the naive one — arena left to grow, one
chunk — by **12.0x**, of which about 3x is the body and about 4x is the cores.
The practical advice is unchanged from when this section had worse numbers,
though its reason is now different and better: **fix the body's allocation
first, then add threads**, not because threads stop working on an allocating
body but because three of those twelve times are free and do not need four
cores to collect.

The cause of the 3x is measured rather than supposed — peak resident set at
four chunks, by `bench/rss.c`:

| | allocated | peak RSS |
| --- | ---: | ---: |
| arena left to grow | 1.6 GB | **1,432,228 KB** (1.37 GiB) |
| arena recycled every 4,096 objects | 1.6 GB | **1,828 KB** |

Three orders of magnitude of peak memory between a program that resets its
arena and one that does not, for the same source and the same output. That
table is this language's central memory trade in two rows, and it belongs in
whatever T4 documents about `parallelFor` bodies.

### 8b. The correction: what the ad-hoc driver got wrong

The first version of this section reported the recycled kernel at **1.86x** on
four threads and built an argument on it — that an allocating body's scaling
collapses, that arena chunk churn was part of the cause (an interval sweep
moving 1.87x to 1.57x as the reset interval grew), and that a residual beyond
that was unexplained. **Re-measured through `nish_parallel_range`, none of that
holds.** The recycled kernel scales 3.97x, the interval sweep is flat, and
there is no residual to explain:

| reset interval | bytes per batch | 1 chunk | 4 chunks | at 4 | ad-hoc driver said |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1,024 objects | 8 KB — never leaves one chunk | 432 ms | 113 ms | **3.82x** | 1.87x |
| 4,096 | 32 KB — still one chunk | 437 ms | 110 ms | **3.97x** | 1.86x |
| 65,536 | 512 KB — eight chunks freed per reset | 376 ms | 97 ms | **3.88x** | 1.57x |

The limiter was the driver, not the workload. Three things say so. The old
curve was **non-monotonic** — 243 ms at two threads and 246 at three — which is
not what a saturating workload looks like and was a signal that should have
been read as one at the time. The new binary's *sequential* path is **slower**
than the old one's (437 ms against 371), so this is not the new driver being
better optimised; only the parallel path moved. And `-pthread`, which
`scripts/build.sh --threads` now passes and the prototype did not, accounts for
about 8% of the gap (112 ms against 121) and so for almost none of it.

What exactly the old driver cost is not established, and this note is not going
to spend more measurements on a program that has been replaced. The lesson
worth keeping is procedural: a prototype's scaffolding is part of what it
measures, and "unexplained residual" was the right label to put on it — the
residual was real, and it was in the scaffolding.

Two things the first measurement got right and that survive: the arithmetic
kernel's near-linear scaling, and the memory table above, which is a
measurement of allocation rather than of timing and was never the driver's to
distort.

### 8c. Design inputs the measurement turned up

Four, and none of them is a number:

1. **The arena's per-thread teardown already exists.** A worker frees *its own*
   arena before returning and leaves the parent's untouched — the thread-local
   storage class does that for free — so the partitioner needed no new runtime
   entry point for cleanup, which removes the thing §3.5's 69-byte budget was
   most likely to be spent on. `runtime_parallel.c` does exactly this and the
   unit test asserts the parent comes through the join byte for byte.
2. **A `parallelFor` still wants an arena story, on memory rather than on
   speed.** §8b retires the scaling argument for this, but §8a's RSS table
   replaces it with a better one: an undisciplined body costs three orders of
   magnitude of peak memory and about 3x of wall clock, both of which the
   compiler can see coming ([wp29-thread-surface.md](wp29-thread-surface.md)
   §8a is the warning).
3. **`--threads` is the wrong default.** The 1.10x to 1.22x at one chunk is the
   price of being *able* to spawn, and a program that never spawns should not
   pay it. T1 should imply the flag from the language surface rather than ask
   for it beside it: a program that names a parallel construct gets the
   thread-local arena, one that does not gets today's binary, byte for byte.
   **Done by WP29 P1:** importing `nish/threads` compiles the program with
   `--threads`, and a program that does not import it is unchanged.
4. **The scaling is measured on kernels, not on `BENCHMARKS.md`.** `nbody` and
   `spectral` are the shapes §4 T4 names, and neither has been partitioned,
   because nothing in the language can partition one. What a `parallelFor` over
   `nbody` returns is T4's own acceptance test and is still unmeasured.

### 8d. The partitioner, as built

`runtime/runtime_parallel.c` is the third translation unit and the stage every
row above now runs through:

```c
typedef void (*nish_par_body)(int64_t lo, int64_t hi, void *ctx);
int64_t nish_cpu_count(void);
void nish_parallel_range(nish_par_body body, void *ctx, int64_t len, int64_t grain);
```

It partitions `[0, len)` into contiguous chunks, at most one element apart in
size so that no worker is the one everybody waits for, at most
`nish_cpu_count()` of them and never more than `len / grain`. Chunk 0 runs on
the calling thread, so N-way parallelism costs N-1 spawns. A chunk whose thread
could not be created runs on the calling thread too, so running short of
threads costs speed and never correctness. A body that itself calls
`nish_parallel_range` runs its range on one thread, because the nesting guard
is thread-local and there is no scheduler here.

It compiles in **both** configurations: without `-DNISH_THREADS`, and on WASI
where there are no threads, the same entry point runs the whole range on the
calling thread, so the flag decides whether the work is divided and never
whether the function exists. Its own `.text*` budget is in `tests/run.js` —
**49 bytes** without the macro and **482** with it, against ceilings of 256 and
512 — and it is a third file rather than a third of `runtime_os.c` precisely
because 482 bytes of partitioner does not fit in the 29 bytes that file had
left, and borrowing the room would have moved the number a reader sees for "the
operating-system surface" for a reason that has nothing to do with the
operating system.

### 8e. What a region costs, and why it is not a goroutine

The threads are the machine's, one per core, created and joined **per region**:
there is no pool, and `nish_cpu_count()` is the only thing that decides how many
there are. So the cost of dividing has to be paid against the work inside, and
here it is, measured on an empty body so that the number is the division and
nothing else:

| | cost |
| --- | ---: |
| a region asking for one chunk — the undivided path, no spawn | **3 ns** |
| an empty region divided four ways — three `pthread_create` plus three joins | **~125 µs** |

That second number is the whole answer to "is this like Go". A goroutine costs
a couple of microseconds to create and a Go program may hold hundreds of
thousands of them; an OS thread here costs about forty times that and the
design holds at most `nish_cpu_count()` of them, by decision (§1). **This is a
mechanism for dividing one loop across the cores, not for having many tasks.**
A region needs on the order of a millisecond of work inside it before the
spawn is under a tenth of its cost, which is the number the compiler's default
`grain` should be picked from when
[wp29-thread-surface.md](wp29-thread-surface.md)'s P1 chooses one — and it is
also why `parallelMapInto` over a short array has to come out as an ordinary
loop rather than as four threads.
P1 picked **2^20 elements** per chunk of a map, one named constant (`GRAIN` in
`self/emit_parallel.ts`, `BLOCK` in `std/threads.ts` for a reduce's blocks), so
a map over at most that many elements is one chunk and takes the 3 ns row.

The 3 ns row is worth its own line because it was 3,734 ns until this was
measured. `nish_cpu_count()` called `sysconf(_SC_NPROCESSORS_ONLN)` on every
region, which glibc answers from `sched_getaffinity` or by parsing
/sys/devices/system/cpu/online, and on a region too small to divide that lookup
*was* the entire cost. It is cached now, in a word read and written with relaxed
atomic builtins, and the undivided path is a bounds test and a call.

What it costs a program that does not use it: **nothing, byte for byte.**
`examples/hello.ts` at the `size` profile is 4,680 bytes with the file linked
and 4,680 without, and the two binaries are identical — `--gc-sections` drops
every function no program calls, whichever translation unit defined it. There
is no language surface, so no rule of [LANGUAGE.md](LANGUAGE.md) moves and
nothing in either compiler changed.

## 9. Appendix: the kernels and the driver, in full

§8's measurements are the facts this note rests on, so the programs are here
rather than only reported, by the convention
[wp24-async.md](wp24-async.md) §11 follows. Nothing below is a test case — the
partitioner's own tests are in `tests/runtime_test.c` — and nothing here uses a
language feature that does not exist.

The kernels, compiled with `--no-stack-alloc` so that the two allocating ones
actually reach the arena rather than being turned into registers by WP6, which
is what they would otherwise be and is a finding of its own:
[wp28-compatibility-mode.md](wp28-compatibility-mode.md) §7.4 prices that
transformation at 8.76x.

```ts
// T4 payoff prototype. Two kernels over a half-open range, each exported with
// the C ABI so a pthreads driver can run T of them over disjoint ranges: the
// arithmetic one to measure scaling where nothing touches the arena, and the
// allocating one to measure it where everything does.
class P {
  x: i32;
  y: i32;
  constructor(x: i32, y: i32) {
    this.x = x;
    this.y = y;
  }
}

export function sumRange(lo: i32, hi: i32): i32 {
  let acc: i32 = 1;
  for (let i: i32 = lo; i < hi; i++) {
    const m: i32 = acc ^ (i * 1103515245);
    acc = ((m >> 13) ^ m) + 1;
  }
  return acc;
}

export function allocRange(lo: i32, hi: i32): i32 {
  let acc: i32 = 1;
  for (let i: i32 = lo; i < hi; i++) {
    const p = new P(i, acc);
    acc = ((p.x * 3) ^ (p.y + 1)) + 1;
  }
  return acc;
}

export function allocRangeScoped(lo: i32, hi: i32): i32 {
  let acc: i32 = 1;
  for (let i: i32 = lo; i < hi; i++) {
    const p = new P(i, acc);
    acc = ((p.x * 3) ^ (p.y + 1)) + 1;
    if ((i & 4095) === 4095) {
      Arena.reset();
    }
  }
  return acc;
}
```

The driver, which is the only part that knows there is more than one thread —
and it knows it only by naming `nish_parallel_range`:

```c
/* The wp20 §8 kernels again, driven by the real runtime entry point instead of
   an ad-hoc pthreads loop: if runtime_parallel.c is the thing the prototype
   predicted, these numbers are the prototype's. */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

extern int sumRange(int lo, int hi);
extern int allocRange(int lo, int hi);
extern int allocRangeScoped(int lo, int hi);

typedef void (*nish_par_body)(int64_t lo, int64_t hi, void *ctx);
int64_t nish_cpu_count(void);
void nish_parallel_range(nish_par_body body, void *ctx, int64_t len, int64_t grain);
void nish_free_arena(void);

static int mode;
static int acc_out;

static void body(int64_t lo, int64_t hi, void *ctx) {
  (void)ctx;
  int r = mode == 2 ? allocRangeScoped((int)lo, (int)hi)
        : mode == 1 ? allocRange((int)lo, (int)hi)
                    : sumRange((int)lo, (int)hi);
  __atomic_fetch_xor(&acc_out, r, __ATOMIC_RELAXED);
}

int main(int argc, char **argv) {
  int64_t total = atoll(argv[1]);
  mode = argc > 2 ? (strcmp(argv[2], "scoped") == 0 ? 2 : strcmp(argv[2], "alloc") == 0) : 0;
  /* grain: ask for at most cpu_count chunks, so the partition matches the
     prototype's one-chunk-per-thread split exactly. */
  int64_t chunks = argc > 3 ? atoll(argv[3]) : nish_cpu_count();
  int64_t grain = (total + chunks - 1) / chunks;
  struct timespec a, b;
  clock_gettime(CLOCK_MONOTONIC, &a);
  nish_parallel_range(body, NULL, total, grain);
  clock_gettime(CLOCK_MONOTONIC, &b);
  double ms = (b.tv_sec - a.tv_sec) * 1000.0 + (b.tv_nsec - a.tv_nsec) / 1e6;
  printf("%s c=%lld %.0f ms acc=%d\n", mode == 2 ? "scoped" : mode ? "alloc" : "arith", (long long)chunks, ms, acc_out);
  return 0;
}
```

Built and run — `rss` is `bench/rss.c`, which is how §8a's peak-memory table
was taken:

```bash
nish kernel.ts --no-stack-alloc -o kernel.ll
scripts/build.sh kernel.ll driver.c runtime/runtime.c -o par --profile speed --threads
./par 800000000 arith  <chunks>      # the arithmetic kernel
./par 200000000 alloc  <chunks>      # the arena left to grow
./par 200000000 scoped <chunks>      # the arena recycled every 4,096 objects
rss ./par 200000000 alloc 4
# and the same three from a build without --threads, for §8's cost table.
# §8b's interval table is the `scoped` kernel with 4095 replaced by 1023 and
# by 65535.
```

`scripts/build.sh` pairs `runtime_os.c` and `runtime_parallel.c` with the
`runtime.c` the command line names, which is why the driver links against a
partitioner it never mentions compiling.
