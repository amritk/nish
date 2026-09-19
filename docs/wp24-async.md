# WP24: Async

**Proposed and then declined, in that order, and the second half is the point.**
No `async`, `await` or `yield` exists in the compiler and this note does not ask
for them to. The one item it did recommend is built: an asynchronous N-API
export, `--emit-napi-async`, which has no language surface at all (§5.1). It is
the plan of record for the question "how does Nish do `async`/`await`", which
[wp20-threads.md](wp20-threads.md) §6 deferred to a note that did not exist
yet. The answer is *not yet, and probably not this*, and the reason is not the
one the question expects: the lowering is cheap and measured below, and what is
missing is anything to wait for.

[LANGUAGE.md](LANGUAGE.md) stays normative. It says today that `async`, `await`
and `yield` are forbidden constructs with Phase 0 rules of their own, and
nothing in this note changes a line of it; where this note and LANGUAGE.md ever
disagree, LANGUAGE.md wins.

Read [wp20-threads.md](wp20-threads.md) first. Most of what a reader wants when
they ask for `async` is in that note under a different name, and §5 here is
mostly a map from one to the other.

## 1. The decision

**Keep the Phase 0 rejections. Build the one thing that is actually being asked
for — an asynchronous N-API export, which has no language surface at all — and
revisit `async`/`await` only behind a networking package that does not exist.**
That one item is now built and measured (§5.1); everything else here still
stands as written.

Three findings, in the order they changed the answer:

1. **There is nothing to await.** Every I/O call in the language is
   synchronous, and there are no sockets, no timers, no sleep and no DNS —
   not "not yet implemented", but *not anywhere in the tree* (§2). An `async`
   function whose body cannot suspend is a `function` with a heap allocation
   in front of it.
2. **The lowering everyone braces for is the cheap part, whichever way it is
   built.** LLVM 18 splits a hand-written coroutine that arrives as textual IR
   and elides the frame entirely — allocation, layout, resume and destroy
   functions, all of it — when the handle does not escape its caller, which is
   the condition `src/codegen/escape.ts` already computes (§3a). And rustc
   does not use those intrinsics at all: it builds a 20-byte struct with a
   one-byte state discriminant and a `switch`, allocates nothing, and that is
   the shape to copy if this is ever built (§3b). Both measured, not
   predicted.
3. **The two things people mean by "async here" both have answers already.**
   Overlapping work is threads, which WP20 designed and argued for on
   soundness grounds; not blocking *Node's* event loop from a Nish addon
   is a change to the generated N-API shim and to nothing else (§5).

So the honest shape of this package is one buildable item with no language
surface, a pointer to WP20 for the rest, and a written-down refusal for the
syntax — the same shape [wp23-language-surface.md](wp23-language-surface.md)
found for most of its list, arrived at the same way.

## 2. There is nothing to await

This is the finding that decides the note, so it is first and it is evidence
rather than assertion.

The whole I/O surface of the language, from LANGUAGE.md ("File I/O",
"Directories and subprocesses", "The environment", "`console`"):

| Call | Blocks on | Would async help? |
| --- | --- | --- |
| `readFileSync`, `readFileSyncOrNull` | a regular-file read | **No.** A regular file is always "ready" to a readiness poller; this is why Node's own `fs` async is a thread pool and not the event loop |
| `writeFileSync`, `appendFileSync` | a regular-file write | No, same reason |
| `console.log` / `write` / `writeError` | `write(2)` to fd 1/2 | Only for a pipe with a full buffer, which is not a workload |
| `spawnSync` | a child process exiting | **Yes** — and it is the one place, which is why `nish_spawn` is also the one builtin nothing `willreturn` can reach |
| `mkdirSync`, `isDirectorySync`, `getenv` | a syscall that returns | No |

And the negative half, which matters more:

```
$ grep -rn "setTimeout\|setInterval\|sleep\|nanosleep\|poll\|epoll\|kqueue\|socket" \
      src/ self/ runtime/ --include="*.ts" --include="*.c" --include="*.h"
$
```

No timer, no sleep, no poller, no socket, in either compiler or either
runtime. A language with no way to be *waiting on something that has not
happened yet* has no use for a construct whose entire job is to give that wait
back to a scheduler.

Two consequences worth stating plainly, because they are what make this a
sequencing decision rather than a taste one:

- **The first deliverable of any async package is not `async`.** It is a
  readiness poller (`epoll` / `kqueue` / WASI `poll_oneoff`), a socket type,
  timers, and the runtime budget conversation that comes with them (§4.5).
  That is a larger package than the syntax by a wide margin, and it is a
  package nobody has asked for: there is no Nish server and no Nish HTTP
  client, and the largest programs in the tree — `self/`, the benchmark suite,
  the examples — are batch jobs that read a file, compute, and exit.
- **`spawnSync` is the one honest candidate, and its answer is threads.**
  Waiting on four children at once is `waitpid` on four threads, needs no new
  syntax, no colour, and no scheduler, and falls out of WP20 T1 without a
  single new rule in LANGUAGE.md.

## 3. The lowering is the cheap part, and here is the measurement

First, a point of vocabulary, because "do we have to use coroutines" is the
question this section is usually asked as. **A coroutine is not an
implementation strategy for `async`/`await` — it is what `async`/`await` is.**
A function that stops in the middle and resumes later has to put its live
locals somewhere other than the stack frame it just left, and there are exactly
three places:

| Where suspended state lives | Cost | Who does it |
| --- | --- | --- |
| a frame holding just the live values (**stackless coroutine**) | one struct per suspended call | Rust, C++20, C#, JavaScript |
| a whole stack per task (**stackful**) | a stack per task, and a moving one if it is to be cheap | Go, and OS threads |
| nowhere: never suspend | a callback or a blocking thread instead | C, and this language today |

The choice is not whether to have a coroutine. It is **who writes the state
machine**, and there are two answers — LLVM, or us. Both were measured.

### 3a. LLVM's answer: `llvm.coro.*`

The reflex objection to coroutines in a language with no GC is that a
coroutine's frame has to outlive the stack frame that created it. It does — and
LLVM already builds that frame, splits the function around it, and throws both
away again when it can see that nobody kept the handle.

A minimal switch-resumed coroutine was written **by hand in textual IR** —
no clang front end, no C++ — and run through the ordinary pipeline, because
textual IR through `opt` is exactly what this compiler produces:

```llvm
define ptr @counter(i32 %n) presplitcoroutine {
entry:
  %id   = call token @llvm.coro.id(i32 0, ptr null, ptr null, ptr null)
  %need = call i1 @llvm.coro.alloc(token %id)
  br i1 %need, label %dyn.alloc, label %begin
  ...
loop:
  %cur = phi i32 [ %n, %begin ], [ %inc, %resume ]
  call void @use(i32 %cur)
  %s = call i8 @llvm.coro.suspend(token none, i1 false)
  switch i8 %s, label %suspend [ i8 0, label %resume
                                 i8 1, label %cleanup ]
  ...
}
```

with a caller that resumes it twice and destroys it; §11 has the whole file, so
the measurement can be re-run rather than believed. Three variants, one command
(`opt -O2`), LLVM 18.1.3:

| The handle | After `opt -O2` |
| --- | --- |
| consumed by the caller, coroutine `external` | caller is three straight-line `use` calls, no frame, no `malloc`; the out-of-line `@counter` survives for external callers and costs a 24-byte `malloc` |
| consumed by the caller, coroutine `internal` | **the whole module is the caller's three `use` calls.** The coroutine, the frame type, the allocation, `@counter.resume` and `@counter.destroy` are all gone |
| stored into a global | frame type, 24-byte `malloc` and both split functions kept, exactly as they must be |

Three things follow, and the second is the one that matters:

- **The split happens.** `llvm.coro.*` in hand-written textual IR is split by
  the default pipeline; nothing in the front end has to lower a state machine
  by hand. This was the open question and it is answered.
- **The coroutine frame is an allocation site, and this repository already has
  the analysis for allocation sites.** `escape.ts` classifies every site as
  `local` / `returned` / `leaks` (wp6-memory.md §1), and LLVM's elision
  condition is `local`. The second row is not a lucky optimisation; it is the
  same proof, done twice.
- **The free case is the default case.** `--strict-exports` is on by default
  since WP15 item 1, so every non-exported function is `internal` — the row
  that vanishes entirely is the row an ordinary program is on.

Two caveats, recorded so that nobody reads the table as a green light:

- **This measures the machine half only.** The compiler half — a suspend point
  in the emitter, the live locals it has to spill, the checker rule that
  colours a function, what `--emit-checked` prints about a coroutine — is
  unmeasured and is most of the work.
- **The elision is an `-O2` transform.** `--profile debug` compiles at `-O0`,
  where the frame is a real allocation through whatever allocator the IR
  names, and `llvm.coro.free` would have to be a no-op under an arena, which
  means a debug build's frames live until the arena is released. A construct
  whose cost model inverts between profiles is one this project has not had
  before.

### 3b. Rust's answer: build the state machine yourself, and never mention LLVM

Rust is the comparison this project is held to everywhere else
([BENCHMARKS.md](BENCHMARKS.md)), and its `async` is a stackless coroutine —
the same category as §3a, reached a different way. **rustc does the transform
itself, in MIR, and hands LLVM ordinary IR.** Measured with the rustc 1.94.1
the benchmark suite already uses, on an `async fn` with two suspension points
and a local live across both (§11 has the program):

| Question | Answer |
| --- | --- |
| `llvm.coro.*` intrinsics in rustc's output | **0**, at `-C opt-level=0` and `2` alike |
| what the generated `poll` does | loads a **one-byte discriminant** at offset 12 of the future and `switch`es on it into five resume points |
| size of the future | **20 bytes**, a plain value with fields at offsets 4, 8, 12 and 16 (`size_of_val` folds to `ret i64 20`) |
| heap allocations on the async path | **0** — no `malloc`, no `__rust_alloc` |

```llvm
; rustc's generated poll, -C opt-level=0: a state machine and nothing else
%2   = getelementptr inbounds i8, ptr %_1, i64 12
%3   = load i8, ptr %2, align 4
%_27 = zext i8 %3 to i32
switch i32 %_27, label %bb6 [ i32 0, label %bb1
                              i32 1, label %bb21
                              i32 2, label %bb20
                              i32 3, label %bb18
                              i32 4, label %bb19 ]
```

The future is a *value*: the caller decides where it lives, and an executor
allocates once per task rather than once per `await`. Nothing in the language
allocates.

**If this feature is ever built here, this is the shape to build, not §3a.**
Three reasons, and the third is the one that decides it:

- A struct with a discriminant and a `switch` over it are constructs this
  language already has, and WP23's numeric `enum` makes the discriminant a
  distinct type rather than a loose `i32`. A state machine is checker and
  emitter work in the vocabulary already in use.
- No dependence on an intrinsic family whose lowering lives in an optimisation
  pass — which is what makes §3a's cost model invert between `--profile debug`
  and `speed`. rustc's output is the same shape at `-O0` and `-O2`.
- The frame stops being special. It is an ordinary allocation site, so
  `escape.ts` classifies it with the rule it already has rather than with
  knowledge of what LLVM will do to `llvm.coro.begin`.

**And Rust's hardest async problem does not arise here.** `Pin`, `Unpin` and
the `unsafe` around them exist because Rust puts locals *in* the frame and lets
a program take a reference to one, so moving the frame invalidates it. Here,
`escape.ts` already decides whether a value is an entry-block `alloca` or arena
memory; a value whose reference is live across a suspend is simply denied the
`alloca`, which is the same judgment wp20 §3.3 needs for a spawn. The category
of pain that dominates Rust's async design is one this memory model skips.

What Rust does pay, and this language would pay identically, is §4.2's colour —
and the runtime. `std` has no executor: an `async fn` that nobody polls is an
inert 20-byte struct, and the reactor (epoll / kqueue, through `mio`) and the
scheduler both arrive as a dependency. **That is §2's finding from the other
side.** Rust demonstrates that the language half of async is cheap; it also
demonstrates that the language half does nothing on its own, and that the half
which does the work is the half this project does not have.

## 4. What it would cost, in the order it bites

### 4.1 A promise type, which is less of a blocker than it looks

**This section originally said `Promise<T>` is a generic and WP18 is therefore
a hard prerequisite. §3b shows that is wrong, and the correction is kept here
rather than quietly edited out, because it moves a gate.**

Rust never names the type. An `async fn` returns `impl Future` — one
*anonymous*, compiler-generated type per async function, unnameable in the
source. The same is available here, and more cheaply: `await` would always
apply to a known call site, so the checker knows statically which state machine
it is resuming and the type never has to be spelled in a program at all. That
is a compiler-generated struct per async function, which is what
`src/checker/classes.ts` already builds for every class — not a generic, and
not a third built-in family beside `Array<T>` and `Result<T, E>`
([wp18-generics.md](wp18-generics.md) §6.1).

What is genuinely lost without generics is every operation that holds pending
work *as data*: no array of futures, so no general `join` or `select`, and no
storing one in a field. A fixed-arity `awaitAll(a, b)` over known call sites is
expressible; a work queue is not. That is a real restriction on how much
concurrency the feature could express, and it is an argument about **A2's**
value rather than a gate in front of **A3** — so WP15 item 8 stops being a
prerequisite and becomes A4, an enhancement. §6's table is corrected to match.

### 4.2 The colour propagates to `main`, and there is no callback to stop it

`Function` is forbidden in Phase 0 as "no dynamic function values", for the
reason LANGUAGE.md gives and `src/codegen/attributes.ts` depends on: the
whole-program fixpoint cannot prove purity, termination or escape through an
unknown callee. So there is no `.then(cb)`, and the only way to consume a
promise is `await` — which colours the caller, and its caller, up to
`export function main`.

A `main` that returns a promise is a runtime that drives a loop. So the first
`async` leaf anywhere in a program links an event loop into a binary whose
whole premise is that `examples/hello.ts` is 4,696 bytes.

### 4.3 The attribute fixpoint pays for every suspend point

This is the same currency WP20 §1 refused to spend, and the bill is larger
here:

- **`willreturn` dies at a suspend.** Nothing in the type system promises a
  resume; a coroutine that is never resumed has not returned. The fixpoint
  propagates that to every caller, and `willreturn` is the attribute
  `src/codegen/attributes.ts` earns from counted loops and pays for everywhere
  else.
- **`readnone` / `readonly` die at the frame spill.** A live local crossing a
  suspend is a store into the frame. A coroutine that reads nothing and writes
  nothing is still `readwrite` the moment it suspends with a value live.

Both are *correct* losses rather than missing work — which is worse, because
no amount of implementation effort recovers them.

### 4.4 The arena, and the flow class WP20 already needs

WP6 §1's stack rule proves that nothing outside the frame can name an object.
A coroutine frame is named by a handle that outlives the frame, so the
uncontested case is the elided one (§3) and the contested case needs the
fourth escape flow — "outlives its creator" — that wp20 §3.3 already needs for
a spawn. One flow class, two customers: if either package is ever built, it is
built once.

### 4.5 The loop does not fit in the runtime budget

`runtime.c` had a hard 4,096-byte `.text` budget and stood at 3,852 when this
note was written (MASTER_PLAN §4); there are now two ceilings, each summed over
every `.text*` section — 3,584 bytes for the core `runtime.c` with 104 bytes of
headroom, and 1,280 for `runtime_os.c` with 90 (`docs/wp7-runtime.md` §"Runtime
additions and budget"). A poller, a timer heap and a ready queue are not 244
bytes, and they are not 90 either.

They would have to be pay-for-what-you-use, exactly as `nish_mkdir` and
`nish_spawn` are — `-ffunction-sections -Wl,--gc-sections` kept
`examples/hello.ts` at the same byte count when those landed (wp20 §3.5) — and
that is an acceptance test, not a hope. A program that never awaits must link
no scheduler.

### 4.6 wasm is the one target where a loop exists, and it is not ours

`runtime_wasm.c` has no loop and cannot have one: the host owns it. Re-entering
a wasm instance in the middle of a function needs JSPI or an Asyncify rewrite,
and WASI preview1 has `poll_oneoff` but the twin has no sockets to poll. So the
target where an event loop already exists is the target where the feature is
someone else's, and the split between the two runtimes (wp20 §2) is what keeps
that from being a fork.

### 4.7 Node is the differential oracle, and async ordering is observable

Every program in `tests/differential/` is rewritten to JavaScript and compared
against Node byte for byte, stdout, exit status and signal
([wp13-differential.md](wp13-differential.md)). Microtask ordering, resolution
order and unhandled-rejection behaviour are all observable through that
comparison, so an `async` that is not Node's `async` is a declared difference
in `known-failures.txt` for a construct users will assume is the same. Today
the Phase 0 rejection keeps that question closed, and that is worth something.

### 4.8 Everything lands twice, and the bootstrap has to close

`src/` and `self/` mirror each other construct for construct and stage1 must
still compile itself to a byte-identical fixed point
([selfhost.md](../.claude/selfhost.md)). A new statement form, a new type
family, a new escape flow and a new diagnostic family are each two
implementations. WP20 §3.6 calls this the single largest multiplier on every
estimate, and it applies here unchanged.

### 4.9 An aside: where the meaning would be decided

`async` is refused twice in stage0 today. Phase 0 refuses it by name for all
four function-like kinds (`src/validator.ts:196-211`, registered for
`FunctionDeclaration`, `FunctionExpression`, `ArrowFunction` and
`MethodDeclaration`), and the checker refuses it again in three —
`src/checker/declarations.ts:37` and `:125` for a declaration and an arrow, and
`src/checker/classes.ts:439` for a method — with generators refused twice more
beside them (`declarations.ts:35`, `classes.ts:468`) and `for await` at
`src/checker/arrays.ts:408`. Phase 0 runs first for every program
(`src/compilation.ts:62`), so the checker's copies are unreachable for anything
that gets that far.

They are not dead weight and should not be deleted: they are the sites that
would decide what `async` *means* if it ever stopped being a Phase 0 error, and
a defence-in-depth rejection in the phase that owns the semantics is the
pattern `.claude/selfhost.md` recommends ("lex and parse what is written;
refuse in the phase that owns the rule"). stage1 refuses the same programs in
its parser, where a different wording is allowed by design
(`tests/self/reject_oracle.js`).

## 5. What to build instead

### 5.1 A1 — an asynchronous N-API export (**the one item recommended — built**)

**No language surface. No new syntax. No coroutine.** The generated shim
changes and nothing else does.

Today `--emit-napi` writes a shim that reads the arguments, calls the Nish
function and boxes the result (`src/interop/napi.ts`), all on the thread N-API
handed it — which for an ordinary `require()`d addon is Node's main thread. A
Nish function that runs for 200 ms blocks Node's event loop for 200 ms.
That is a real defect against MASTER_PLAN §1's fourth vision bullet ("Nish
exports `.wasm` / native addons that Node imports"), and it is the complaint
that usually arrives dressed as "does Nish support async".

The fix is the N-API one: `napi_create_async_work` to run the call on libuv's
thread pool, `napi_create_promise` / `napi_resolve_deferred` so JavaScript gets
a promise. The Nish function stays exactly as synchronous as it is now; the
asynchrony is entirely in generated C.

- **Prerequisite: WP20 T0, the thread-local arena — landed, so this is now
  buildable.** ([wp20-threads.md](wp20-threads.md) §4 T0: `nish --threads`
  plus `scripts/build.sh --threads`.) The worker thread
  allocates, and `@nish_arena` is one process-wide object whose bump is
  inlined into the IR (wp20 §3.1). Without T0 this was a data race in the
  emitted IR, not merely in the runtime. **T0 was the whole cost of A1**, which
  was the argument for landing it on its own, and the argument held: the shim
  and the `napi` profile's build line were all that was left of this item, and
  both are now written.
- **Surface, as built: `--emit-napi-async <shim.c>`, a sibling output flag**
  rather than a modifier on `--emit-napi` or a per-function opt-in. It writes
  the same shim *plus* a promise-returning `<name>Async` beside every export
  whose arguments and result are plain scalars. Additive was the decision worth
  making: the synchronous export is what the WP8 batching benchmark calls and
  what a host wanting the answer *now* still wants, so a host chooses per call
  site instead of per build, the two can be measured against each other inside
  one addon, and no existing addon's surface moves. A per-function opt-in would
  have needed syntax, and syntax is the thing this item is valuable for not
  having.
- **`--threads` is required on both halves, and neither absence is silent.**
  The worker allocates while the JS thread runs, so the arena has to be the
  thread-local one — and it has two halves: the generated C, and the module's
  own IR. For the C, the shim opens with an `#error` unless `-DNISH_THREADS` is
  set, because one process-wide bump allocator shared by two threads corrupts
  silently. For the module, `nish --emit-napi-async` **refuses to run without
  `--threads`** (exit 2), which is the less obvious half and the one worth
  writing down: a module that allocates inline reads `@nish_arena` as a plain
  global without the flag (`examples/arrays.ts` is one), and nothing downstream
  catches it — the shim's `#error` cannot see the module, and the *link* does
  not object either. nish.h says ELF refuses a non-TLS reference against a
  `_Thread_local` definition; measured, that holds for an executable and **not**
  for the `-shared -fPIC` napi profile, which links such a mismatch without a
  word. So the flag is required where both facts are known rather than switched
  on quietly, because the arena's storage class is ABI and no request for a
  sidecar should change it as a side effect.
  The exec callback then brackets the call with `nish_arena_mark` /
  `nish_arena_release` on the worker's *own* arena — both on the one thread that
  allocates in it — so a reused pool thread stays flat rather than growing for
  the life of the process.
- **Scalars only, and the rest of the surface says why.** A string or
  typed-array parameter or result keeps its synchronous wrapper alone and is
  named in the shim with the reason, the way the unbridgeable functions already
  are. Two different reasons, and the second is the sharper one: the arena is
  per-thread, so a mark taken on the JS thread cannot be released on the
  worker; and a typed array is *borrowed* from the JS `ArrayBuffer`, which
  N-API guarantees only for the duration of the callback that read it, while an
  asynchronous call outlives that callback by design and the buffer can be
  detached mid-flight. A by-value `Result` *parameter* does cross — it is
  scalars in a register, read on the JS thread like any other argument — and a
  `Result` *result* does not yet, because boxing one is several `napi_*` calls
  inside the completion callback. A `malloc`ed copy is the shape that lifts the
  restriction and is deliberately not in this cut.
- **`<name>Async` rejects and never throws.** The promise is created before the
  arguments are read, so a wrong argument settles as a rejected `TypeError`
  carrying the message the synchronous wrapper throws. A promise-returning
  function that threw synchronously would be the one failure a `.catch` cannot
  reach, and `await` would surface it from the call rather than from the settle.
- **Acceptance, measured rather than asserted.** `examples/node-addon-async.mjs`
  is the harness and `tests/self/interop_async.ts` the addon; a ticker asking to
  be woken every 5 ms reports its worst lateness, which is the latency the loop
  shows a user:

  | | call | worst loop stall | ticks during the call |
  | --- | --- | --- | --- |
  | `spin(120000)` | 220 ms | **218.06 ms** | 8 |
  | `await spinAsync(120000)` | 220 ms | **0.36 ms** | 42 |

  The call takes just as long either way, and that is the point: nothing became
  faster and no compiled function changed, so 220 ms of work is still 220 ms of
  work. What moved is who waits for it. Read the tick column beside the stall —
  8 ticks means the 5 ms ticker was starved for the whole call and Node fired
  the backlog at once when it returned, while 42 is roughly the 220 / 5 the loop
  should have managed. Over three runs the synchronous stall stayed between
  218.06 and 221.43 ms and the asynchronous one between 0.36 and 1.77 ms
  (§11c). The rest of the acceptance list holds too: the `napi` profile still
  builds, the batching benchmark is untouched
  because it calls the synchronous export, and a program compiled without the
  flag emits a byte-identical shim — checked over the whole interop corpus, IR
  included, against the generator as it stood before the change.
- **It landed twice, like everything else** (§4.8): `src/interop/napi.ts` and
  `self/interop_napi.ts`, with `tests/self/interop_oracle.js` diffing the
  `.napi.c` of both compilers byte for byte over the corpus, the asynchronous
  sidecar now among them. The stage1 half is where the closure-free shape shows:
  `src/` passes each wrapper a `fail` closure and `self/` passes a mode, and the
  three modes — throw, release the arena and throw, reject the promise — spell
  the same three failing returns.
- **Sound under ThreadSanitizer.** The addon built with `-fsanitize=thread` and
  driven by 64 concurrent `digestAsync` calls — a function that allocates on
  every round, so several workers bump their arenas at once — reports no race in
  any `nish_*` frame or in the generated shim across repeated runs, and every
  answer matches the synchronous one. (The only races tsan reports at all are
  inside V8's own tracing controller, which is uninstrumented.)

### 5.2 Threads, for everything async is usually reached for

Overlapping `spawnSync` waits, parallelism across cores, a long computation
that must not stall a caller: all WP20, all designed, and all argued from the
same zero-GC constraints. The benchmark programs that have ever sat outside the
1.10x target were not waiting on I/O — they were waiting on one core.

### 5.3 Nothing, for the rest

There is no third item, and saying so is the useful part of this note.

## 6. If it is ever built, the order is forced

Not a schedule — a dependency chain, each link of which is someone else's
package:

| | Gate | Owner |
| ---: | --- | --- |
| A0 | the coroutine spike, both ways | **done, §3a and §3b** |
| A1 | asynchronous N-API export | **done, §5.1** — `--emit-napi-async`, after WP20 T0 |
| A2 | a reason: sockets, timers, a poller, and the budget conversation | unowned; nobody has asked |
| A3 | `async` / `await` as a rustc-shaped state machine: the colour rule, the suspend point, the anonymous frame type, the frame's escape flow | this note, and only after A2 |
| A4 | futures as data — an array of them, `join`, `select` | WP15 item 8 / WP18, an enhancement of A3 rather than a gate before it (§4.1) |

A2 is the load-bearing link, and it is the only one. Without it, A3 builds a
mechanism with nothing to drive it — which is the trap this note exists to
name. Note what A3 does *not* wait for: generics were listed as a prerequisite
in the first draft of this note and are not one (§4.1).

## 7. Declined, with the rule each one breaks

In the house style, because a plan of record that says what it turned down is
worth more than one that only says yes.

- **`async` as an accepted no-op keyword** (parsed, erased, the function
  compiled synchronously). Tempting — it costs nothing and makes some
  TypeScript compile unchanged. Refused: it makes a program mean something
  *different* under Node than it does here, in the one direction
  `tests/differential/` exists to prevent, and it promises a concurrency the
  binary does not have. A rejection with a message is better than a lie with
  none.
- **A user-nameable `Promise<T>`** — §4.1. Not because it is hard, but because
  it is unnecessary: Rust's `impl Future` is anonymous and `await` always
  applies to a known call site, so a promise type that a program can *spell*
  buys only the operations §4.1 lists as lost, and each of those wants WP18
  anyway.
- **Callback-style async** (`readFile(path, cb)`) — needs a function value, and
  `Function` is Phase 0's, for the attribute-fixpoint reason in §4.2. This is
  the same refusal WP20 §2 counted as an *asset*.
- **Generators and `yield` as a way to write iterators** — the iterator case
  is WP15 item 3 (slice iterators), which is emitter work with no frame, no
  allocation and no suspend point. A coroutine is a large price for a `for`
  loop that already exists.
- **A green-thread scheduler / M:N async runtime** — wp20 §1's argument
  unchanged: a growable stack needs relocation, relocation needs a precise GC,
  and zero GC is MASTER_PLAN §1's first bullet. It is not a smaller ask here
  than it was there.
- **`for await`** — there is no async iterator to iterate; the rule stays where
  it is (`src/checker/arrays.ts:408`, LANGUAGE.md "`for (const x of a)`").
- **Matching Node's microtask semantics** — §4.7. Not declined on the merits;
  declined as a thing to sign up for before there is an implementation to hold
  to it.

## 8. What would change the answer

Written down so that a future reader can check the trigger rather than
re-argue the case. **The trigger is I/O, not syntax.**

- Someone wants to write a **server** in Nish — sockets, many connections,
  most of them idle. That is the workload async was invented for and the only
  one that beats a thread per connection. It would make A2 a real package with
  a real acceptance test, and everything after it follows.
- A **wasm host** that wants a Nish module to yield mid-function, once JSPI
  is ordinary. That is a different design (the host owns the loop) and would be
  its own note, not this one.
- WP18 landing, which would make A4 — futures held as data, `join`, `select` —
  expressible. Worth having and still not a trigger: a promise with nothing to
  promise is still nothing.

None of this is pre-1.0. M4 freezes the language reference (MASTER_PLAN §9) and
this note adds no rule to it: `async`, `await` and `yield` stay forbidden with
the messages they have, so the freeze is not waiting on anything here. A1 has
no language surface and can land whenever WP20 T0 does.

## 9. What the refusal costs, and what survives it

The two questions a decision to not build something has to answer: does waiting
foreclose anything, and which parts of the feature are still reachable when the
trigger arrives.

### 9.1 Waiting forecloses nothing in the language, and that is checked

**Adding `async` later breaks no program that compiles today.** `async` and
`await` are *contextual* in TypeScript's grammar, and this compiler inherits
that grammar, so both are ordinary identifiers now and stay ordinary
identifiers after. Checked against the `typescript` package's own parser and
against the compiler:

| Program | Today | After `async` exists |
| --- | --- | --- |
| `export function async(n: i32): i32` | compiles | still parses — `async function async() {}` is valid TypeScript |
| `let async: i32 = 41;` | compiles | unaffected |
| `let await: i32 = 0;` in a **sync** function | compiles | unaffected |
| `let await = 1;` inside an **async** function | n/a | rejected, exactly as JavaScript rejects it |

So there is no keyword to reserve before the M4 freeze, and no migration note
to write. The only programs that could break are ones whose author has just
added `async` to the enclosing function, which is their edit and their
rejection.

### 9.2 What waiting does cost

Four things, none of them large, listed so that whoever picks this up later
knows what drifted:

- **The N-API defect was A1's cost rather than async's, and it is now paid.**
  An addon that ran for 200 ms blocked Node's event loop for 200 ms; A1 fixed
  that without deferring anything about the language feature, which was the
  argument for separating them in the first place (§5.1 has the measurement).
- **The arena bracket quietly accumulates an assumption.** WP6's automatic
  scopes and WP9's call-site reclaim both bracket a *contiguous dynamic extent*
  with `nish_arena_mark` / `release` / `keep`. A suspend point in the middle of
  such a bracket is precisely what those brackets are not built for: a
  coroutine that suspends inside a scoped function would have its memory
  released underneath it. The rule an async package needs is therefore "a
  function that can suspend gets no automatic scope, and an awaited call gets
  no call-site reclaim bracket" — cheap to state now, and more expensive the
  more later optimisations assume that extent is contiguous. Whoever writes the
  next arena optimisation should know there is a future customer for the
  assumption.
- **The fourth escape flow may get built narrowly.** §10 already carries this:
  if WP20 T1 lands "escapes to another thread" rather than the general
  "outlives its creator", async re-derives it.
- **Everything lands twice, and `self/` keeps growing.** §4.8's multiplier is
  applied to whatever the language is on the day the work starts, not to what
  it is today.

### 9.3 What survives: `async`/`await` yes, the promise *object* no

This is the useful shape of the answer, and it is Rust's shape rather than
JavaScript's. **The syntax and the semantics of sequential suspension survive.
The promise as a first-class value does not.**

| What a JavaScript programmer expects | Reachable? | What it needs |
| --- | --- | --- |
| `async function f()` and `await g()` | **yes** | A2, then A3. No generics (§4.1) |
| `await` on a known call site, sequentially | **yes** | the same |
| fixed-arity `awaitAll(f(), g())` over known calls | **yes** | the same — both callees are static, so no type is named |
| homogeneous `awaitAll(fs)` over an array of pending calls | **yes, after WP18** | futures held as data — A4 |
| `Promise.all([a, b])` typed as a *tuple* of mixed types | **no, not in that form** | tuples plus variadic generics; wp23 §5 decides `Pair<A, B>` as a library type under WP18 rather than tuple syntax, and stops at two |
| `p.then(x => ...)` with an inline callback | **no** | a function value, which Phase 0 forbids — and the prohibition is load-bearing, not incidental |
| `p.then(namedFunction)` | **conceivable, speculative** | wp23 §6's compile-time function parameters, itself after WP18 and explicitly not a relaxation of function values |
| storing a promise in a field, passing it around, attaching a handler later | **no** | the same function-value prohibition, plus futures-as-data |

The `.then` row is the one worth being plain about, because it is the only
entry here refused by a decision the project has **already made and already
lives with** rather than by work nobody has done. `Result` has no `map`,
`andThen` or `orElse` for exactly this reason — "they need function values,
which Nish forbids: the whole-program pass cannot prove purity, termination or
escape through an unknown callee" ([wp16-results.md](wp16-results.md) §"Left
out") — and `.then` is `andThen` wearing a promise. A language that rejected
`Result.map` and then accepted `Promise.prototype.then` would be trading the
attribute fixpoint for a spelling.

What that leaves is the Rust arrangement, which is a coherent language rather
than a diminished one: you get `async` and `await`, suspension is sequential
and reads like straight-line code, and the state machine is anonymous. What you
do not get is the promise as a thing you hold.

## 10. Open

- ~~**How an asynchronous N-API export is spelled.**~~ **Decided** (§5.1):
  `--emit-napi-async <shim.c>`, a sibling output flag that *adds* a
  `<name>Async` rather than replacing the synchronous export. What remains open
  is narrower and waits for a real addon to argue it: whether a string or an
  array should cross asynchronously through a `malloc`ed copy, and whether a
  by-value `Result` result is worth the boxing in the completion callback.
- **Whether a `sleep(ms)` builtin should exist at all.** It is the only thing a
  program could await today, which is either the argument for a small async or
  the argument that this is what threads are for. It leans towards the second.
- **Nothing, about what a debug build of a coroutine would cost.** That was an
  open question while §3a was the only plan; §3b answers it by not depending on
  an optimisation pass, so a state machine built the way rustc builds one has
  the same shape at `-O0` and `-O2`. It returns as a question only if anyone
  argues for the intrinsics after all.
- **Whether the fourth escape flow is WP20's or this note's.** Both need it,
  neither is building it, and whichever package gets there first should own it
  rather than inventing a parallel one.

## 11. Appendix: the spikes, in full

§3's measurements were the only new facts in this note when it was written, so
both are reproducible here rather than only reported; §11c is the same courtesy
for A1's, which are the numbers §5.1 rests on.

### 11a. The LLVM spike (§3a)

Save as `coro.ll` and run `opt -O2 -S coro.ll -o -` (LLVM 18.1.3). For the
second row of §3a's table, change `define ptr @counter` to
`define internal ptr @counter`; for the third, replace the body of `@driver`
with a `store` of the handle into a global.

```llvm
; A minimal switch-resumed coroutine, hand-written, to answer two questions:
;   1. does LLVM 18's default -O2 pipeline split a `presplitcoroutine` function
;      that arrives as textual IR (no clang front end involved)?
;   2. is the heap frame elided when the handle does not escape the caller?
declare token @llvm.coro.id(i32, ptr, ptr, ptr)
declare i1 @llvm.coro.alloc(token)
declare i32 @llvm.coro.size.i32()
declare ptr @llvm.coro.begin(token, ptr)
declare i8 @llvm.coro.suspend(token, i1)
declare ptr @llvm.coro.free(token, ptr)
declare i1 @llvm.coro.end(ptr, i1, token)
declare void @llvm.coro.resume(ptr)
declare void @llvm.coro.destroy(ptr)

declare noalias ptr @malloc(i32)
declare void @free(ptr)
declare void @use(i32)

define ptr @counter(i32 %n) presplitcoroutine {
entry:
  %id = call token @llvm.coro.id(i32 0, ptr null, ptr null, ptr null)
  %need = call i1 @llvm.coro.alloc(token %id)
  br i1 %need, label %dyn.alloc, label %begin

dyn.alloc:
  %size = call i32 @llvm.coro.size.i32()
  %mem = call ptr @malloc(i32 %size)
  br label %begin

begin:
  %phi = phi ptr [ null, %entry ], [ %mem, %dyn.alloc ]
  %hdl = call noalias ptr @llvm.coro.begin(token %id, ptr %phi)
  br label %loop

loop:
  %cur = phi i32 [ %n, %begin ], [ %inc, %resume ]
  call void @use(i32 %cur)
  %s = call i8 @llvm.coro.suspend(token none, i1 false)
  switch i8 %s, label %suspend [ i8 0, label %resume
                                 i8 1, label %cleanup ]
resume:
  %inc = add i32 %cur, 1
  br label %loop

cleanup:
  %freeable = call ptr @llvm.coro.free(token %id, ptr %hdl)
  %null = icmp eq ptr %freeable, null
  br i1 %null, label %suspend, label %do.free
do.free:
  call void @free(ptr %freeable)
  br label %suspend

suspend:
  %unused = call i1 @llvm.coro.end(ptr %hdl, i1 false, token none)
  ret ptr %hdl
}

define i32 @driver() {
  %hdl = call ptr @counter(i32 7)
  call void @llvm.coro.resume(ptr %hdl)
  call void @llvm.coro.resume(ptr %hdl)
  call void @llvm.coro.destroy(ptr %hdl)
  ret i32 0
}
```

### 11b. The Rust spike (§3b)

Save as `a.rs` and run, with the rustc the benchmark suite uses:

```
rustc --edition=2021 --crate-type=lib --emit=llvm-ir -C opt-level=0 a.rs -o a0.ll
grep -c 'llvm\.coro' a0.ll                     # 0
grep -n 'switch i32' a0.ll                     # the state machine
rustc --edition=2021 --crate-type=lib --emit=llvm-ir -C opt-level=2 a.rs -o a2.ll
sed -n '/define.*@future_size/,/^}/p' a2.ll     # ret i64 20
```

```rust
// The smallest honest async fn: two suspension points and a live local
// crossing both. No tokio, no executor -- just the state machine rustc builds.
use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};

pub struct YieldOnce(bool);

impl Future for YieldOnce {
    type Output = i32;
    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<i32> {
        if self.0 {
            Poll::Ready(7)
        } else {
            self.0 = true;
            cx.waker().wake_by_ref();
            Poll::Pending
        }
    }
}

pub async fn counter(n: i32) -> i32 {
    let a = YieldOnce(false).await;
    let b = YieldOnce(false).await;
    n + a + b
}

/// Forces codegen of the state machine: build the future, poll it once.
#[no_mangle]
pub extern "C" fn drive(n: i32, cx: &mut Context<'_>) -> i32 {
    let mut f = counter(n);
    // Safety: `f` is not moved again after this point in this toy driver.
    let p = unsafe { Pin::new_unchecked(&mut f) };
    match p.poll(cx) {
        Poll::Ready(v) => v,
        Poll::Pending => -1,
    }
}

/// The size of the state machine rustc built, as a constant it folds.
#[no_mangle]
pub extern "C" fn future_size() -> usize {
    core::mem::size_of_val(&counter(0))
}
```

### 11c. A1's event-loop measurement (§5.1)

Three commands, from a clean checkout with LLVM 18 and Node 22 on `PATH`:

```bash
node dist/index.js tests/self/interop_async.ts -o build/spin.ll \
  --emit-napi-async build/spin_napi.c --threads
scripts/build.sh build/spin.ll runtime/runtime.c build/spin_napi.c \
  -o build/spin.node --profile napi --threads
node examples/node-addon-async.mjs build/spin.node 120000
```

`examples/node-addon-async.mjs` is the harness rather than a throwaway script,
so the measurement is a thing a reader can re-run and a user can point at their
own addon. It runs a `setInterval` asking for 5 ms, records the worst gap it
actually sees, and prints one line per call shape. Three consecutive runs on one
machine (x86-64, Node 22.22, `--profile napi --threads`):

```
sync spin()        call   223 ms   worst loop stall   221.43 ms   over   8 ticks
async spinAsync()  call   220 ms   worst loop stall     0.36 ms   over  42 ticks
sync spin()        call   220 ms   worst loop stall   219.05 ms   over   8 ticks
async spinAsync()  call   219 ms   worst loop stall     0.40 ms   over  42 ticks
sync spin()        call   220 ms   worst loop stall   218.06 ms   over   8 ticks
async spinAsync()  call   220 ms   worst loop stall     1.77 ms   over  42 ticks
```

Read the tick column, not only the stall: 8 ticks means the ticker was starved
for the whole call and Node fired the backlog at once when it returned, while
42 is roughly the 220 ms / 5 ms the loop should have managed. The stall column
is the same fact from the other side, and the wall column is what makes it a
scheduling change rather than an optimisation — the work is identical and takes
identical time.

The soundness half, which is not a latency question:

```bash
# 64 concurrent calls to a function that allocates on every round, under tsan
clang -std=c11 -O1 -g -fsanitize=thread -DNISH_THREADS=1 -ftls-model=initial-exec \
  -fPIC -shared -Wno-override-module -I"$NODE_INCLUDE" -Iruntime \
  build/spin.ll runtime/runtime.c runtime/runtime_os.c build/spin_napi.c \
  -o build/spin_tsan.node
LD_PRELOAD=$(clang -print-file-name=libtsan.so) node examples/node-addon-async.mjs build/spin_tsan.node
```

No race in any `nish_*` frame or in the generated shim, and every asynchronous
answer equal to its synchronous twin. tsan does report a race inside
`v8::platform::tracing::TracingController`, which is Node's own uninstrumented
code and is there with or without this addon loaded.

