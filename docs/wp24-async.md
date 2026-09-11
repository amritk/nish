# WP24: Async

**Proposed and then declined, in that order, and the second half is the point.**
Nothing here exists in the compiler and this note does not ask for it to. It is
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

Three findings, in the order they changed the answer:

1. **There is nothing to await.** Every I/O call in the language is
   synchronous, and there are no sockets, no timers, no sleep and no DNS —
   not "not yet implemented", but *not anywhere in the tree* (§2). An `async`
   function whose body cannot suspend is a `function` with a heap allocation
   in front of it.
2. **The lowering everyone braces for is the cheap part.** LLVM 18 splits a
   hand-written coroutine that arrives as textual IR, and elides the frame
   entirely — allocation, layout, resume and destroy functions, all of it —
   when the handle does not escape its caller. Measured, not predicted (§3).
   The condition under which it is free is the condition
   `src/codegen/escape.ts` already computes.
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

with a caller that resumes it twice and destroys it; §10 has the whole file, so
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

## 4. What it would cost, in the order it bites

### 4.1 `Promise<T>` is a generic type, and generics are WP18

There is no monomorphisation today, and `Array<T>` and `Result<T, E>` are
built-in rather than library types precisely because of that
([wp18-generics.md](wp18-generics.md) §6.1, which also argues against adding a
third such family by hand — the argument wp20 §4 accepted at stage T3 for
channels). `Promise<T>` would be exactly that third family. WP15 item 8 is the
prerequisite and this note does not route around it.

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

`runtime.c` has a hard 4,096-byte `.text` budget and stands at 3,852
(MASTER_PLAN §4). A poller, a timer heap and a ready queue are not 244 bytes.

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

### 5.1 A1 — an asynchronous N-API export (**the one item recommended**)

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

- **Prerequisite: WP20 T0, the thread-local arena.** The worker thread
  allocates, and `@nish_arena` is one process-wide object whose bump is
  inlined into the IR (wp20 §3.1). Without T0 this is a data race in the
  emitted IR, not merely in the runtime. **T0 is the whole cost of A1**, which
  is another reason T0 is worth landing on its own.
- Surface: a flag (`--emit-napi-async`) or a per-function opt-in; §9 leaves
  that open, because it should be decided against a real addon.
- Acceptance: the `napi` profile still builds and the WP8 batching benchmark
  is unchanged; event-loop latency measured under a long call, before and
  after, and written down rather than asserted; a program that does not use
  the flag generates a byte-identical shim.

### 5.2 Threads, for everything async is usually reached for

Overlapping `spawnSync` waits, parallelism across cores, a long computation
that must not stall a caller: all WP20, all designed, and all argued from the
same zero-GC constraints. The four benchmark programs outside the 1.10x target
are not waiting on I/O — they are waiting on one core.

### 5.3 Nothing, for the rest

There is no third item, and saying so is the useful part of this note.

## 6. If it is ever built, the order is forced

Not a schedule — a dependency chain, each link of which is someone else's
package:

| | Gate | Owner |
| ---: | --- | --- |
| A0 | the coroutine spike | **done, §3** |
| A1 | asynchronous N-API export | this note, after WP20 T0 |
| A2 | a reason: sockets, timers, a poller, and the budget conversation | unowned; nobody has asked |
| A3 | `Promise<T>` as a monomorphised type | WP15 item 8 / WP18 |
| A4 | `async` / `await`, the colour rule, the suspend point, the frame flow | this note, and only after A2 and A3 |

A2 is the load-bearing link. Without it, A3 and A4 build a mechanism with
nothing to drive it — which is the trap this note exists to name.

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
- **`Promise<T>`** — §4.1. A generic type in a compiler with no
  monomorphisation is a third built-in family, which wp18 §6.1 argues against
  by name.
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
- WP18 landing and making A3 nearly free — necessary, and still not
  sufficient: a promise with nothing to promise is still nothing.

None of this is pre-1.0. M4 freezes the language reference (MASTER_PLAN §9) and
this note adds no rule to it: `async`, `await` and `yield` stay forbidden with
the messages they have, so the freeze is not waiting on anything here. A1 has
no language surface and can land whenever WP20 T0 does.

## 9. Open

- **How an asynchronous N-API export is spelled.** A `--emit-napi-async` flag
  for the whole module, a per-function opt-in in the source, or a rule based on
  the function's measured cost — decided against a real addon, not in this
  note.
- **Whether a `sleep(ms)` builtin should exist at all.** It is the only thing a
  program could await today, which is either the argument for a small async or
  the argument that this is what threads are for. It leans towards the second.
- **What a debug build of a coroutine would cost**, if A4 is ever reached
  (§3's second caveat): the frame elision is an `-O2` transform and
  `--profile debug` is `-O0`.
- **Whether the fourth escape flow is WP20's or this note's.** Both need it,
  neither is building it, and whichever package gets there first should own it
  rather than inventing a parallel one.

## 10. Appendix: the spike, in full

§3's measurement is the only new fact in this note, so it is reproducible here
rather than only reported. Save this as `coro.ll` and run
`opt -O2 -S coro.ll -o -` (LLVM 18.1.3 above). For the second row, change
`define ptr @counter` to `define internal ptr @counter`; for the third, replace
the body of `@driver` with a `store` of the handle into a global.

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
