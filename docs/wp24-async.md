# WP24: Async

**Status: settled. `async`/`await` is refused, and the one item this note
recommended is built.** That item is `--emit-napi-async`, an asynchronous N-API
export with no language surface. It shipped in 0.3.0
([#67](https://github.com/amritk/nish/pull/67)). `async`, `await` and `yield`
remain Phase 0 errors, as [LANGUAGE.md](LANGUAGE.md) states. §8's trigger has
since fired: WP34 needed a real server. The answer held. `nish:net` (0.15.0,
[#341](https://github.com/amritk/nish/pull/341),
[#349](https://github.com/amritk/nish/pull/349)) gives a program non-blocking
sockets and a readiness loop it owns, and the language gained no colour.
The full note, with the spikes' source, is this file at commit `2b2eb95c`.

## 1. The decision

**Keep the Phase 0 rejections. Build the one thing that was actually being
asked for, an asynchronous N-API export. Revisit `async`/`await` only behind a
networking package.** Three findings decided it:

1. **There was nothing to await** (§2).
2. **The lowering is the cheap part**, measured both ways (§3).
3. **The two things people mean by "async here" already have answers.**
   Overlapping work is threads ([wp20-threads.md](wp20-threads.md)). Not
   blocking Node's event loop from a Nish addon is a change to the generated
   shim (§5.1).

## 2. There is nothing to await

When this note was written, every I/O call in the language was synchronous, and
there were no sockets, timers, sleep or DNS anywhere in either compiler or
runtime. A regular-file read is always "ready" to a readiness poller, which is
why Node's own `fs` async is a thread pool. The one honest candidate,
`spawnSync`, is answered by threads.

So the first deliverable of any async package is not `async`. It is a poller,
a socket type, timers and the runtime budget that comes with them. **What
happened when that package arrived** (WP34 N5): the poller and the sockets were
built as `nish:net`, and the program *is* the loop. It calls `pollWait`, which
blocks in `epoll` (kqueue on Darwin) until a descriptor is ready or a deadline
passes. Every
socket is non-blocking. That is what tokio runs underneath a Rust server, and
it needs no colour in the language (LANGUAGE.md, "`nish:net`").

## 3. The lowering is the cheap part, and here is the measurement

A coroutine is not an implementation strategy for `async`/`await`; it is what
`async`/`await` is. The real question is who writes the state machine: LLVM or
the front end. Both were measured.

### 3a. LLVM's answer: `llvm.coro.*`

A hand-written switch-resumed coroutine in textual IR, run through `opt -O2`
(LLVM 18.1.3), is split by the default pipeline. When the handle does not
escape and the coroutine is `internal`, **the whole frame, its allocation and
both split functions disappear**. This elision condition is the `local` flow
the escape analysis already computes, and `--strict-exports` makes it the
default case. Two caveats. This measured only the machine half. And elision is
an `-O2` transform, so a `--profile debug` build would allocate real frames,
which inverts the cost model between profiles.

### 3b. Rust's answer: build the state machine yourself, and never mention LLVM

rustc 1.94.1 emits **no** `llvm.coro.*` intrinsics. An `async fn` with two
suspension points becomes a **20-byte** value with a one-byte discriminant and
a `switch` into five resume points, and makes **no heap allocations**. This is
the same at `-O0` and `-O2`.

**If async is ever built here, this is the shape to build, not §3a's.** A
struct with a discriminant and a `switch` are constructs the language already
has, and an `enum` can be the discriminant. The cost model does not depend on
an optimisation pass. The frame is an ordinary allocation site. Rust's hardest
problem, `Pin`, does not arise, because a value whose reference is live across
a suspend would simply be denied its `alloca`. What Rust demonstrates is that
the language half is cheap, and that it does nothing without the runtime half.

## 4. What it would cost, in the order it bites

### 4.1 A promise type, which is less of a blocker than it looks

An `async fn` can return an anonymous, compiler-generated state-machine type, as
Rust's `impl Future` does. So generics are not a prerequisite. What needs them
is futures held *as data*: arrays of futures, a general `join` or `select`.
That is A4 (§6), an enhancement rather than a gate.

### 4.2 The colour propagates to `main`, and there is no callback to stop it

With no function values there is no `.then(cb)`, so `await` colours every caller
up to `main`. A `main` that returns a promise needs a runtime that drives a
loop.

### 4.3 The attribute fixpoint pays for every suspend point

`willreturn` is lost at a suspend, because nothing promises a resume.
`readnone`/`readonly` are lost at a frame spill. Both are *correct* losses, and
no implementation effort recovers them.

### 4.4 The arena, and the flow class WP20 needs

A frame named by a handle that outlives its creator needs the same "outlives
its creator" escape flow wp20 §3.3 needed for a spawn.

### 4.5 The loop must be pay-for-what-you-use

A poller, timer heap and ready queue would not fit the runtime's `.text`
ceilings as unconditional cost. A program that never awaits must link no
scheduler. `nish:net` follows this rule as a translation unit of its own,
`runtime-net.c`.

### 4.6 wasm is the one target where a loop exists, and it is not ours

The host owns the loop, and re-entering an instance mid-function needs JSPI or
Asyncify.

### 4.7 Node is the differential oracle, and async ordering is observable

Microtask and resolution order are visible to `tests/differential/`, so an
`async` that is not Node's would be a declared difference for a construct users
assume is the same.

### 4.8 Everything lands twice

That was true while stage0 existed. Since WP19 R6, a construct is written once,
in `src/`.

### 4.9 Where the meaning would be decided

`async` is refused in Phase 0, and the parser refuses the same programs. A
later `async` would be decided in the checker, which owns the semantics.

## 5. What to build instead

### 5.1 A1 — an asynchronous N-API export (**the one item recommended — built**)

**No language surface, no new syntax, no coroutine.** `--emit-napi-async
<shim.c>` writes the `--emit-napi` shim plus a promise-returning `<name>Async`
beside every export whose arguments and result are plain scalars. The call runs
on libuv's thread pool through `napi_create_async_work`, and the Nish function
is unchanged. Decisions:

- **It is a sibling output flag, and additive.** A host chooses per call site,
  and no existing addon's surface moves. A per-function opt-in would have
  needed syntax.
- **`--threads` is required on both halves.** The shim opens with `#error`
  unless `-DNISH_THREADS` is set. `nish --emit-napi-async` refuses to run
  without `--threads` (exit 2), because a `-shared -fPIC` link accepts a
  TLS/non-TLS mismatch without a word. The exec callback brackets the call with
  `nish_arena_mark`/`release` on the worker's own arena.
- **Scalars only.** A mark taken on the JS thread cannot be released on a
  worker. A typed array is borrowed from an `ArrayBuffer` only for the duration
  of one callback.
- **`<name>Async` rejects and never throws**: a bad argument settles as a
  rejected `TypeError`.
- **Measured** with `examples/node-addon-async.mjs` and a 5 ms ticker (§11c):

  | | call | worst loop stall | ticks during the call |
  | --- | --- | --- | --- |
  | `spin(120000)` | 220 ms | **218.06 ms** | 8 |
  | `await spinAsync(120000)` | 220 ms | **0.36 ms** | 42 |

  The work takes as long as before. What moved is who waits for it. Under
  ThreadSanitizer, 64 concurrent calls to an allocating function reported no
  race in any `nish_*` frame or in the shim.

### 5.2 Threads, for everything async is usually reached for

Overlapping waits, parallelism across cores and a long computation that must
not stall a caller are all WP20 and [wp29-thread-surface.md](wp29-thread-surface.md),
and most of that is built.

### 5.3 Nothing, for the rest

There is no third item.

## 6. If it is ever built, the order is forced

| | Gate | State |
| ---: | --- | --- |
| A0 | the coroutine spike, both ways | **done**, §3 |
| A1 | asynchronous N-API export | **done**, §5.1 |
| A2 | a reason: sockets, timers, a poller | **arrived** as WP34's `nish:net`, and answered without async (§2) |
| A3 | `async`/`await` as a rustc-shaped state machine | not wanted: A2 did not ask for it |
| A4 | futures as data: an array of them, `join`, `select` | an enhancement of A3; generics have landed |

## 7. Declined, with the rule each one breaks

- **`async` as an accepted no-op keyword.** It would make a program mean
  something different under Node, and promise concurrency the binary does not
  have.
- **A user-nameable `Promise<T>`.** It is unnecessary: an anonymous state
  machine and a known call site are enough (§4.1).
- **Callback-style async.** It needs a function value.
- **Generators as iterators.** WP15 item 3 covered iteration without a frame,
  and `for...of` over an array is already free.
- **A green-thread / M:N runtime.** wp20 §1: a growable stack needs a precise
  GC.
- **`for await`.** There is no async iterator to iterate.
- **Matching Node's microtask semantics** before there is an implementation to
  hold to them.

## 8. What would change the answer

**The trigger is I/O, not syntax.** The triggers were a server (many
connections, most of them idle), and a wasm host that wants a module to yield
mid-function once JSPI is ordinary. The first fired with WP34, and the answer
was a program-owned loop (§2). A wasm yield would be its own note. WP18 landing
made A4 expressible, but it is not a trigger: a promise with nothing to promise
is still nothing.

## 9. What the refusal costs, and what survives it

### 9.1 Waiting forecloses nothing in the language, and that is checked

`async` and `await` are contextual in TypeScript's grammar, so they are
ordinary identifiers today and would stay so. No keyword needs reserving, and
adding `async` later breaks no program that compiles now.

### 9.2 What waiting does cost

**The arena brackets assume a contiguous dynamic extent.** WP6's automatic
scopes and WP9's call-site reclaim bracket one with `nish_arena_mark` and
`release`. A suspend in the middle would release memory underneath a
coroutine. Any async package needs the rule "a function that can suspend gets
no automatic scope, and an awaited call gets no call-site reclaim bracket", and
the rule gets more expensive the more later optimisations rely on the
assumption.

### 9.3 What survives: `async`/`await` yes, the promise *object* no

If async is ever built, it is Rust's arrangement: sequential suspension and an
anonymous state machine. Fixed-arity `awaitAll(f(), g())` over known calls is
reachable. Promises held as data are reachable only with A4.
`p.then(x => ...)` is **not** reachable. It needs a function value, and that is
refused for the reason `Result` has no `map` or `andThen`
([wp16-results.md](wp16-results.md)): the whole-program pass cannot prove
purity, termination or escape through an unknown callee. `Promise.all` over a
mixed tuple is not reachable either: `Pair<A, B>` stops at two (wp23 §5).

## 10. Open

- **Strings and arrays across `<name>Async`**, through a `malloc`ed copy, and a
  by-value `Result` result. Both wait for a real addon to argue for them.
- **A `sleep(ms)` builtin.** The case for it is weaker now that `pollWait`
  takes a timeout.
- ~~Whether the fourth escape flow is WP20's or this note's.~~ Neither built it
  as a separate flow. wp29's scalar-result rule made it unnecessary for threads
  (wp20 §3.3).

## 11. Appendix: the spikes, in full

### 11a. The LLVM spike (§3a)

`coro.ll`: a hand-written `presplitcoroutine` `@counter` and a `@driver` that
resumes it twice and destroys it. Run with `opt -O2 -S coro.ll -o -`. The
source is in this file at commit `2b2eb95c`.

### 11b. The Rust spike (§3b)

`a.rs`: `async fn counter` awaiting a hand-written `YieldOnce` future twice.
`grep -c 'llvm\.coro'` on the emitted IR answers 0, and `future_size()` folds
to `ret i64 20`. The source is in this file at commit `2b2eb95c`.

### 11c. A1's event-loop measurement (§5.1)

```bash
nish tests/self/interop-async.ts -o build/spin.ll \
  --emit-napi-async build/spin_napi.c --threads
scripts/build.sh build/spin.ll runtime/runtime.c build/spin_napi.c \
  -o build/spin.node --profile napi --threads
node examples/node-addon-async.mjs build/spin.node 120000
```

Three runs on x86-64 with Node 22.22 gave a synchronous stall of 218.06 to
221.43 ms over 8 ticks, and an asynchronous stall of 0.36 to 1.77 ms over 42
ticks. `tests/run.js` runs the same harness at a smaller size. The
ThreadSanitizer run builds the same files with `-fsanitize=thread
-DNISH_THREADS=1 -ftls-model=initial-exec -fPIC -shared` and preloads
`libtsan.so`. Its only reports are inside V8's uninstrumented tracing
controller.
