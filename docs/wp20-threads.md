# WP20: Threads

**Status: complete, and superseded for the surface by
[wp29-thread-surface.md](wp29-thread-surface.md).** T0, the thread-local arena
behind `--threads`, shipped in 0.2.0 ([#55](https://github.com/amritk/nish/pull/55)).
The runtime partitioner, `runtime/runtime-parallel.c`, shipped in 0.3.0
([#88](https://github.com/amritk/nish/pull/88)). The language surface this note
staged as T1 to T4 was redesigned and reordered by wp29. Its P1 (data
parallelism, 0.11.0, [#219](https://github.com/amritk/nish/pull/219)) is T4, and
its P2 (`using s = scope()`, 0.13.0, [#262](https://github.com/amritk/nish/pull/262))
is T1. Its P3, a lock that owns its data, is T3 and is proposed. This note
remains the record of *whether* and *why*: 1:1 OS threads, with data races
rejected at compile time. [LANGUAGE.md](LANGUAGE.md) ("Data parallelism",
"Scoped tasks") is normative. The full plan, with the prototype kernels and
driver that §8 measured, is this file at commit `2b2eb95c`
(`git show 2b2eb95c:docs/wp20-threads.md`).

## 1. The decision

**1:1 OS threads, with data races rejected at compile time. Not goroutines,
and not Go's runtime-detector posture.** Two independent arguments reach this
answer.

- **Goroutines need a moving stack, and a moving stack needs a GC.** Green
  threads are cheap because the runtime can relocate a stack. It can do that
  only because a precise collector knows which words are pointers. WP6 turns
  non-escaping allocations into entry-block `alloca`s, and the soundness
  argument for that is that nothing outside the frame can name the object.
  Relocating the frame breaks that argument. So frames are fixed and a thread
  is an OS thread. M:N scheduling would be a different design with a different
  memory model, not a later optimisation of this one.
- **A race is a miscompile here, not a bug for a detector to find.**
  `src/attributes.ts` emits `readnone`, `readonly` and the pointer-parameter
  facts from a whole-program fixpoint. Every one of those proofs assumes a
  single mutator. Unsynchronised shared mutation makes them false, and a false
  LLVM attribute is undefined behaviour. **Either the checker rejects data
  races statically, or the attribute fixpoint is given up.** So the answer is
  Rust's.

## 2. What the language already gives us

Each of these assets comes from a decision taken for another reason.

| Asset | What it buys |
| --- | --- |
| **No mutable global state.** Top-level `let`, static fields and top-level statements are refused, and a module `const` folds into the IR | Everything two threads can both reach arrived through a pointer somebody passed, which is what an analysis can follow. [wp23-language-surface.md](wp23-language-surface.md) §4 declined module-level `let` partly to keep this row |
| **No closures and no function values** | A parallel body or a task entry is a known function. The "what did the closure capture" problem, which costs Rust `move` plus `Send` and costs Go a GC, does not arise |
| **A whole-program compiler** | A `Send`-shaped judgment is the existing fixpoint with one more fact, not a trait system |
| **Checked immutability**: immutable strings, `readonly T[]` | A starting set of values that are safe to share |
| **Nothing unwinds** | A thread trampoline has one exit and no cleanup path |
| **Separate native and wasm runtimes** | wasm threads (§6) can be deferred without a fork |

## 3. What blocks it, in the order it bites

### 3.1 The arena is one global, and the bump is inlined into the IR

The allocator's fast path is an `alwaysinline` function that GEPs into
`@nish_arena` and does a non-atomic load, add and store. Two threads allocating
is therefore a race in the emitted IR, and a fix in `runtime.c` alone cannot
reach it. The fix is a thread-local arena (§4 T0). `nish_arena_mark`,
`release` and `keep` become per-thread, so WP6's scopes and WP9's call-site
reclaim are per-thread by construction.

### 3.2 The other runtime globals

The RNG seed `nish_rng` is `_Thread_local` under `-DNISH_THREADS`. Each thread's
stream is untorn and independent, but not distinct: threads that start in the
same second seed from the same time and pid. A program that needs distinct
streams seeds them itself, and there is no API for that yet. `nish_argv` is
written once before `main` and deliberately stays process-wide.
`runtime/runtime.c` gives the reason beside each.

### 3.3 Per-thread arenas make lifetime a new question

A pointer bumped on one thread is reclaimed by that thread's release, possibly
while another thread still holds it. The plan called for a fourth escape flow,
"escapes to another thread". It was not built as a separate class. wp29's
rules removed the need: a parallel body or a task may not hand back anything
but a scalar, and the whole-program pass treats a task's parameters as
escaping (wp29 §4.2, §7).

### 3.4 Structured threads are sound much more cheaply than detached ones

If every join happens inside the spawning frame's arena bracket, children may
borrow the parent's data freely. This is Rust's `std::thread::scope`, and it
fits WP6's brackets. Detached threads would need an owned transfer: a copy into
the receiver's arena or atomic reference counting. **Structured only; detached
threads are not in the plan.**

### 3.5 The runtime budget

Thread support must be pay-for-what-you-use, as `nish_spawn` is.
`-ffunction-sections -Wl,--gc-sections` drops every function a program does
not call, and a program that never spawns must link the same binary it did
before. That is an acceptance test. The live `.text*` ceilings are in
[wp7-runtime.md](wp7-runtime.md) §"Runtime additions and budget" and
`tests/run.js`.

### 3.6 Every rule lands twice

That was true when this note was written: stage0 and `src/` mirrored each other,
and the bootstrap had to close over both. Stage0 was deleted in WP19 R6
([wp19-stage0-retirement.md](wp19-stage0-retirement.md)), so a construct is now
written once, in `src/`.

## 4. The staged plan

| Stage | As planned here | What became of it |
| --- | --- | --- |
| **T0** | thread-local arena and RNG behind `--threads`, no language surface | **built**, 0.2.0 |
| **T1** | `Thread.spawn` / `join`, every handle joined on every path | **built as wp29 P2**, with `using s = scope()` emitting the join rather than an analysis proving it |
| **T2** | a shareable-type rule: `Send`/`Sync` without traits | **not built as a list.** P1 judges a body by its *shared writes* plus a reachability rule. P2 runs tasks only while the parent waits in the join, so any argument may be handed over (wp29 §4.1, §4.2) |
| **T3** | channels and mutexes, after generics | **proposed as wp29 P3** (§4.3) |
| **T4** | a `parallelFor`-shaped intrinsic over a `readonly` slice | **built as wp29 P1**: `parallelMapInto` and `parallelReduce`, on the partitioner of §8d |

### T0 — A thread-safe runtime, with no language surface — **done**

T0 is one declaration line in the IR,
`@nish_arena = external thread_local(initialexec) global %struct.nish_arena`,
and one storage class (`NISH_TLS`, empty without `-DNISH_THREADS`) in the C.
The allocator's body is unchanged. `initialexec` is named so that the `-fPIC`
napi profile does not lower an allocation to `__tls_get_addr`. With the flag
off, nothing moved: no golden, no runtime byte, no `hello` byte. With it, a
loop that does nothing but bump paid **1.48x**, and `bench/strbuild` and
`bench/nbody` paid nothing measurable. Tests: `tests/cases/mem_threads_arena`,
the `-DNISH_THREADS` half of `tests/runtime-test.c`, and the `--threads` link
checks in `tests/run.js`.

## 5. Diagnostics

This note proposed `reject_thread_*` cases for an unjoined handle, an escaping
handle and an unshareable argument. wp29's design removed the first two. The
rules that shipped (no shared write, no arena control, a scalar result, among
others) and their codes are in LANGUAGE.md's two threads sections. The quality
bar stands: a refusal names the write, field or path that disqualified the
body, not just the type.

## 6. Not in this plan

- **wasm threads.** These need shared memory, the `atomics` and `bulk-memory`
  features, and workers on the JavaScript side. `runtime-wasm.c` mirrors
  `NISH_TLS` so that a `--threads` build links, but a wasm module still has one
  thread.
- **Detached threads** (§3.4), and the atomic reference counting they would need.
- **Async/await.** [wp24-async.md](wp24-async.md) refuses it.
  [wp28-compatibility-mode.md](wp28-compatibility-mode.md) §6 proposes lowering
  a *ported* `await` onto this note's threads, which by decision comes after
  the threads (§7).
- **A race detector.** §1 says why the static rule replaces it.
- **Atomics as a user-facing type.** An escape hatch from the sharing rule should
  be designed after that rule has met real programs.

## 7. Sequencing

T0 went first because it was separable and its cost was a benchmark question.
It landed on that argument. The rest was first ordered T1, T2, T3, T4. wp29 §8
reversed the order, on §8's measurement: data parallelism is where the payoff
is, and it is the only stage that needs no handle, no join proof and no capture
rule. The order became T4, T1, T3 (P1, P2, P3), with T2 split between the first
two.

One ordering decision also binds WP28: **threads come first.** A compatibility
`await` lowered onto threads is designed only after the thread surface exists
with its own rules and diagnostics. Otherwise the sharing rule would be
designed through a keyword that hides it.

## 8. The T4 payoff, measured

Three kernels, compiled to the C ABI, run through `nish_parallel_range` over a
fixed amount of work with the chunk count as the only variable. Four physical
cores of an Intel Xeon at 2.80 GHz, no SMT, best of five. Only the ratios are
meaningful.

| Kernel | 1 chunk | 2 | 4 | at 4 |
| --- | ---: | ---: | ---: | ---: |
| arithmetic: a hash chain, no allocation | 977 ms | 489 ms | 247 ms | **3.96x** |
| allocating: one 8-byte object per iteration, arena left to grow | 1,323 ms | 744 ms | 428 ms | **3.09x** |
| the same, with `Arena.reset()` every 4,096 objects | 437 ms | 216 ms | 110 ms | **3.97x** |

At one chunk, the `--threads` build cost nothing on the arithmetic kernel,
1.10x on the growing-arena kernel and 1.22x on the recycled one.

### 8a. The two multipliers compose, and that is the useful result

| | arena grows | arena recycled | discipline is worth |
| --- | ---: | ---: | ---: |
| 1 chunk | 1,323 ms | 437 ms | **3.03x** |
| 4 chunks | 428 ms | 110 ms | **3.89x** |
| **cores are worth** | **3.09x** | **3.97x** | |

The best configuration beats the naive one by **12.0x**: about 3x from the
body and about 4x from the cores. **Fix the body's allocation first, then add
threads.** The 3x is memory. At four chunks, by `bench/rss.c`, the growing
arena peaked at 1,432,228 KB (1.37 GiB) and the recycled one at 1,828 KB, for
the same 1.6 GB allocated. This is why wp29 P1 gives an allocating body an arena
scope per element, and warns about it (NL9012, wp29 §8a).

### 8b. The correction: what the ad-hoc driver got wrong

An earlier version of this section used an ad-hoc pthreads driver and reported
the recycled kernel at **1.86x**. It built a scaling argument on that number.
Re-measured through `nish_parallel_range`, the kernel scales 3.97x and the
reset-interval sweep is flat (3.82x to 3.97x). The driver was the limiter, not
the workload. The old curve was non-monotonic, which should have been read as
a warning at the time. The lesson is procedural: a prototype's scaffolding is
part of what it measures.

### 8c. Design inputs the measurement turned up

1. **Per-thread arena teardown already exists.** A worker frees its own arena
   and leaves the parent's untouched, so the partitioner needed no cleanup
   entry point.
2. **A parallel body wants an arena story, for memory rather than speed**
   (§8a). It became P1's per-element scope and NL9012.
3. **`--threads` is the wrong default, so the surface implies it.** **Done by
   WP29 P1:** importing `nish/threads` compiles the program with `--threads`,
   and a program that does not import it is byte-identical.
4. **The scaling was measured on kernels, not on the benchmark suite.** wp29
   §8a has P1's numbers on `bench/par_*`, including an n-body kernel.

### 8d. The partitioner, as built

```c
typedef void (*nish_par_body)(int64_t lo, int64_t hi, void *ctx);
int64_t nish_cpu_count(void);
void nish_parallel_range(nish_par_body body, void *ctx, int64_t len, int64_t grain);
```

`runtime/runtime-parallel.c` splits `[0, len)` into contiguous chunks that
differ in size by at most one element. There are at most `nish_cpu_count()`
chunks and never more than `len / grain`. Chunk 0 runs on the calling thread.
A chunk whose thread cannot be created also runs there, so a shortage of
threads costs speed, never correctness. A nested call runs on one thread,
because the nesting guard is thread-local. Without `-DNISH_THREADS`, and on
WASI, the same entry point runs the whole range on the calling thread. It is a
translation unit of its own, with its own `.text*` ceiling in `tests/run.js`.

### 8e. What a region costs, and why it is not a goroutine

There is no pool. Threads are created and joined **per region**, one per core
at most.

| | cost |
| --- | ---: |
| a region asking for one chunk, which spawns nothing | **3 ns** |
| an empty region divided four ways: three `pthread_create` plus three joins | **~125 µs** |

A goroutine costs a couple of microseconds. **This is a mechanism for dividing
one loop across the cores, not for having many tasks.** A region needs about a
millisecond of work before the spawns are under a tenth of its cost. That is
why the grain matters. P1 first used 2^20 elements per chunk. It now sizes the
grain per call as `2^22` over a static estimate of one element's cost
(`mapGrain` in `src/parallel.ts`, calibrated in wp29 §8a). A map within its
grain calls its loop directly. A reduce's block width is a separate constant
(`BLOCK` in `std/threads.ts`, 2^20), because it decides the reduce's answer,
while the grain only decides how the work is divided. The 3 ns row was
3,734 ns until `nish_cpu_count()` cached its `sysconf` answer. A program that
does not use the partitioner pays nothing: `--gc-sections` drops it.

## 9. Appendix: the kernels and the driver

The three kernels (`sumRange`, `allocRange`, `allocRangeScoped`, compiled with
`--no-stack-alloc`) and the C driver that calls `nish_parallel_range` are in
this file at commit `2b2eb95c`. The data-parallel kernels that are maintained
now are `bench/par_*.ts`, run by `node bench/run.mjs`.
