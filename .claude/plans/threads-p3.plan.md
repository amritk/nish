---
name: Threads P3 — a lock that owns its data
overview: WP29's open stage. Ship Mutex<T> from nish/threads, a lock whose data can be named only through a guard bound by using, and Channel<T> of scalars, so a scope's tasks may share mutable state and pass values without a data race or a deadlock.
stages:
  - id: p3-design
    title: "docs(threads): decide WP29 P3, the lock and the channel"
    goal: wp29 §4.3, a new §4.4 and §11 state the decided rules for Mutex<T> and Channel<T>, so the build stages and every later reader have one record of why
    verification: node docs/check-links.mjs && npm run lint
    todos:
      - id: design-mutex-rules
        content: Rewrite wp29 §4.3 with the Mutex<T> rules R1–R8 and the reason each exists — see p3-design
      - id: design-node-order
        content: State in wp29 §4.3 what a guarded program means under Node and the author's commutativity obligation — see p3-design
      - id: design-channel
        content: Add wp29 §4.4 with the Channel<T> rules C1–C7 and the reason each exists — see p3-design
      - id: design-open-list
        content: Close the §11 items P3 answers and add the ones it opens — see p3-design
  - id: p3-mutex
    title: "feat(checker): Mutex<T>, a lock that owns its data, in nish/threads"
    goal: A program can share a guarded value between a scope's tasks through using g = m.lock(), natively on many threads and under Node, and every rule R1–R8 is enforced with its own diagnostic
    verification: bash scripts/fetch-seed.sh --force && npm run check && npm test && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node tests/diagnostic-coverage.js --require-coverage && npm run lint
    todos:
      - id: mutex-runtime
        content: Add the lock primitive to runtime/runtime-parallel.c and its declarations to runtime/nish.h — see p3-mutex
      - id: mutex-std
        content: Add Mutex<T> and MutexGuard<T> to std/threads.ts with their Node meaning — see p3-mutex
      - id: mutex-checker
        content: Admit m.lock() as the third using disposable and enforce R1–R8 in src/parallel.ts with new NL codes in src/codes.ts — see p3-mutex
      - id: mutex-codegen
        content: Lower lock and release at every exit of the guard block in src/emit-parallel.ts — see p3-mutex
      - id: mutex-tests
        content: Golden .ll, llvm-as, native round trips under tests/link, one negative per rule with .err pins — see p3-mutex
      - id: mutex-docs
        content: Add the LANGUAGE.md section, the cookbook entry and the docs/AI.md rule — see p3-mutex
      - id: mutex-goldens
        content: Regenerate tests/self/goldens and tests/differential/goldens with their tools, never by hand — see p3-mutex
  - id: p3-channel
    title: "feat(checker): Channel<T> of scalars, closed when its senders return, in nish/threads"
    goal: A scope's tasks can pass scalars through an unbounded channel that closes when every task that sends on it has returned, natively and under Node, and every rule C1–C7 is enforced with its own diagnostic
    verification: bash scripts/fetch-seed.sh --force && npm run check && npm test && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node tests/diagnostic-coverage.js --require-coverage && npm run lint
    todos:
      - id: channel-runtime
        content: Add the channel buffer, send, receive and sender count to runtime/runtime-parallel.c and runtime/nish.h — see p3-channel
      - id: channel-std
        content: Add Channel<T> to std/threads.ts with its Node meaning — see p3-channel
      - id: channel-checker
        content: Enforce C1–C7 in src/parallel.ts with new NL codes in src/codes.ts, including the sender-before-receiver spawn order — see p3-channel
      - id: channel-codegen
        content: Lower send, the receiving for-of and the per-task sender registration in src/emit-parallel.ts — see p3-channel
      - id: channel-tests
        content: Golden .ll, llvm-as, native round trips under tests/link, one negative per rule with .err pins — see p3-channel
      - id: channel-docs
        content: Add the LANGUAGE.md section, the cookbook entry and the docs/AI.md rule — see p3-channel
      - id: channel-goldens
        content: Regenerate tests/self/goldens and tests/differential/goldens with their tools, never by hand — see p3-channel
  - id: p3-close
    title: "docs(threads): mark WP29 P3 built, with a measured example"
    goal: The repo's maps say P3 is built and an example program shows the lock with a measured number
    verification: npm run check && npm test && node docs/check-links.mjs && npm run lint
    todos:
      - id: close-example
        content: Add examples/histogram.ts and time it — see p3-close
      - id: close-status
        content: Mark P3 built in wp29, wp20, MASTER_PLAN and std/README.md — see p3-close
---

# Threads P3 — a lock that owns its data

## Context

[wp29](../../docs/wp29-thread-surface.md) staged the thread surface in three. P1 (`parallelMapInto`, `parallelReduce`, 0.11.0) and P2 (`using s = scope()`, 0.13.0) are built; P3, a lock that owns its data, is the open stage and [MASTER_PLAN](../../docs/MASTER_PLAN.md#what-remains) lists it third. §11's first open item is the whole problem: a P2 task is held to P1's no-shared-write rule, and writing through a lock's guard *is* a shared write. P3 decides how that write is admitted.

What exists that P3 builds on: the scope runs every task when it joins, the first on the calling thread, while the parent waits (`nish_scope_join`, [runtime-parallel.c](../../runtime/runtime-parallel.c)); `using` already takes two disposables, `scope()` and `arena()`, and the join and release are emitted at every exit of the block (`src/emit-parallel.ts`); a worker's arena is freed at the join, which is why a task's answer is a scalar (wp29 §7).

## Approach

Rust's shape, narrowed until no borrow checker is needed, and narrow on purpose: every rule below can be widened later without a break, and a wide rule can only be narrowed by one (the argument P2 used for `using`).

```ts
import { Mutex, scope } from "nish/threads";

class Hist { bins: i32[] = [0, 0, 0, 0, 0, 0, 0, 0]; }

const binShard = (s: Shard): i32 => {
  for (const x of s.xs) {
    using g = s.hist.lock();
    g.value.bins[x & 7] = g.value.bins[x & 7] + 1;
  }
  return 0;
};

const hist = new Mutex<Hist>(new Hist());
{
  using s = scope();
  s.spawn(binShard, new Shard(xs0, hist), done, 0);
  s.spawn(binShard, new Shard(xs1, hist), done, 1);
}
```

## p3-design

**Owns:** `docs/wp29-thread-surface.md`

The rules the build stage implements, which this stage writes into wp29 §4.3 with the reason each exists (the build stage implements from this plan and does not wait for this PR, but this PR merges first):

| | Rule | Why |
|---|---|---|
| R1 | `new Mutex<T>(init)` takes a value that is fresh all the way down: `init` is a `new` expression or a literal whose every argument or element is a scalar or is itself fresh by this rule (so `new Hist(bins)` and `[row]` with a named `bins` or `row` are refused). The value inside is reachable only through a guard; `Mutex` has no public `value`. | An alias kept outside the lock is an unguarded path to the data — the thing Rust's design removes. |
| R2 | `m.lock()` is only the initialiser of a `using` declaration, the third disposable beside `scope()` and `arena()`. The release is emitted at every exit of the block, as the join is. | A guard bound any other way is one nobody releases. |
| R3 | A guard is used only as `g.value`, and `g.value` only as the base of a chain of member and element accesses. A chain that is read yields a scalar, or is itself the base of a further access or a store: `g.value.bins[i]` is a read, `const b = g.value.bins` is refused. Neither the guard nor anything a chain reaches is bound, passed, returned, stored or captured. | Nothing derived from the guard outlives the block that holds the lock. |
| R4 | Every store through a guard stores a scalar (a number, a `boolean` or an enum), to a field or to an element of an array that already exists. No method call through `g.value` (so no `push`, which can reallocate into the worker's arena). | A task's arena is freed at the join (§7); a pointer into it stored in the parent's data would dangle. |
| R5 | Inside a guard's block — directly or through any function it calls — no second `lock()`, no `scope()` or `spawn`, no `parallelMapInto` or `parallelReduce`. | One lock held at a time, and nothing waited on while it is held: **a P3 program cannot deadlock**, by construction, with no lock-order analysis. |
| R6 | A task may write shared memory only through a guard. P2's rule is otherwise unchanged. | The lock is the one admitted shared write, which is §11's question answered. |
| R7 | Between a scope's first `spawn` and the end of its block, the parent does not lock a mutex any of that scope's tasks can reach. After the join it may. | The existing P2 rule ("neither reads a destination nor writes memory a task may read"), extended: natively the tasks run at the join, under Node at the spawn. |
| R8 | A `Mutex` reaches a task as the task's argument or as a field of a class the argument is; it is never a destination. | It is how a task names shared state at all, and it keeps the reachability R7 needs computable. |

**What a guarded program means.** The tasks' critical sections run one at a time in some order. Natively the order is the scheduler's; under Node it is spawn order, which is one of the native orders. So a program whose guarded updates commute (a sum, a count, a min, a histogram) prints the same thing both ways, and one whose updates do not is the author's obligation — the same position `parallelReduce` takes for a named function's associativity. The checker does not try to prove commutativity.

**Channel<T>, §4.4.** Built in this run by `p3-channel`. The rules:

| | Rule | Why |
|---|---|---|
| C1 | `T` is a scalar: a number, a `boolean` or an enum. | A sender's arena is freed at the join (§7); a non-scalar element would be a pointer into it. Non-scalars wait for copy-at-join. |
| C2 | `new Channel<T>()` is made by the parent and reaches a task as R8 says a `Mutex` does: the argument, or a field of a class the argument is. Never a destination. | Reachability is what C5 and C6 are computed from. |
| C3 | Unbounded: `ch.send(x)` never blocks. | A bounded channel can block a sender under Node, where nothing else is running to drain it. |
| C4 | A channel is reachable from the tasks of exactly one scope. The parent may send only before that scope's first `spawn`, and after the join it may only receive. No `close()`. A channel closes when every task of the scope that may send on it has returned; the parent may also send before the scope's first `spawn`. "May send" is the call graph from the task's entry reaching `send` on a channel reachable from its argument, so an over-count only closes it later. | Go's "who closes it" question, removed: nobody can close too early, or twice. |
| C5 | Receiving is `for (const x of ch)`, which ends when the channel is closed and drained. Inside a scope's block the parent never receives; after the join it may, and the loop drains what is left. | A receive is the one wait; this keeps the parent's only wait the join. |
| C6 | Every task that may send on a channel is spawned before every task that may receive on it, and no task both sends and receives on one channel. | Under Node, tasks run at their spawn, so a receiver spawned first would wait forever. The same order makes the sender→receiver graph acyclic, so **channels cannot deadlock** either. |
| C7 | No receive inside a guard's block (R5's "nothing waited on while a lock is held"). A `send` there is allowed, since it never waits. | Keeps the no-deadlock argument whole when locks and channels meet. |

What a channel program means: a receiver sees every value sent, each sender's values in its send order; how two senders' values interleave is the scheduler's natively and spawn order under Node. A receiver whose answer depends on that interleaving is the author's obligation, as for the lock. The buffer lives outside every arena (senders' arenas are freed at the join) and is given back when a receiving loop drains a closed channel; a channel never drained keeps its remainder until exit, which LANGUAGE.md states. `select` stays declined (§9).

**§11.** Close "How P3 fits P2's rule" with R6 and R5, and "What a Channel<T> of a non-scalar costs" as C1 (scalars now, non-scalars with copy-at-join). Open: whether R4 widens to strings once copy-at-join exists; whether a guard may be passed to a function that provably does not keep it (escape analysis, `src/escape.ts`).

_Amended 2026-10-11T00:55Z after #560's review: R1 made transitive, R3 limited to chains that end in a scalar, and C4 limited to one scope. The design worker found these gaps, and each change narrows a rule rather than widening it._

## p3-mutex

**Owns:** `src/**`, `std/threads.ts`, `runtime/runtime-parallel.c`, `runtime/nish.h`, `runtime/nish.d.ts`, `runtime/nish.mjs`, `runtime/runtime-wasm.c`, `tests/cases/**`, `tests/link/**`, `tests/wordings/**`, `tests/self/goldens/**`, `tests/differential/goldens/**`, `tests/differential/known-failures.txt`, `tests/run.js`, `tests/nish/**`, `docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`, `docs/cookbook/**`, `docs/RUN_UNDER_NODE.md`, `docs/AI.md`, `tests/parser/**`, `tests/parser-oracle.js`

- **Runtime.** A lock word inside the `Mutex` object, taken with an acquire `cmpxchg` and released with a release store; the contended path calls one runtime function in `runtime/runtime-parallel.c` that spins briefly, then yields. No per-lock allocation outside the arena, so there is nothing to destroy. If the worker finds a measured reason to prefer `pthread_mutex_t`, it says so in the PR. On `wasm32`, follow whatever `scope()` does there today, and pin it with a test.
- **std.** `Mutex<T>` and `MutexGuard<T>` in [std/threads.ts](../../std/threads.ts), whose bodies are the Node meaning: `lock()` answers a guard over the value and `[Symbol.dispose]` does nothing, since under Node tasks run one at a time.
- **Checker.** R1–R8, each with its own `NL` code and registry wording in `src/codes.ts`, in the voice of the existing scope rules. Extend the `using` refusal (the code whose wording begins "`using` takes only `scope()`") to name the lock. The rolling freeze applies: `src/` must not use `Mutex` itself.
- **Codegen.** Lock at the `using`, release at the block's end and at every `return`, `break` and `continue` that leaves it, inside every arena scope — the same exit set the scope join already uses.
- **Tests.** A golden `.ll` for a guarded increment and its `llvm-as` pass; native round trips under `tests/link/` (N tasks × K increments prints N·K; the histogram) whose expected stdout is also what Node prints; one negative per rule with a `tests/wordings/` pin; one negative showing an unguarded task write is still refused. Show the exact IR for every TypeScript snippet the PR adds, in the PR body.
- **Docs.** A `docs/LANGUAGE.md` section "A lock that owns its data: `Mutex<T>`" after "Scoped tasks", stating R1–R8 and the Node meaning; a cookbook entry for the lowered lock and release; the rule in one paragraph and a compiled example in `docs/AI.md` (P2's #262 shipped its AI.md entry the same way).
- **Goldens.** `node tests/self/goldens.js --update` and `node tests/differential/goldens.js --update`; read both diffs before committing.

## p3-channel

**Owns:** the same globs as `p3-mutex`. It starts after `p3-mutex` merges — the two edit the same files (`src/parallel.ts`, `std/threads.ts`, `src/codes.ts`, `docs/LANGUAGE.md`, the goldens), so they cannot be developed at once.

- **Runtime.** A chunked buffer of 8-byte slots outside the arena, a lock, a condition to wait on, and a count of live senders. The scope's join registers each task that may send before running it, and the task's finish decrements; at zero the channel is closed and waiters wake. Freed when a receiving loop drains it closed. On `wasm32`, follow what `scope()` and `Mutex` do there.
- **std.** `Channel<T>` in [std/threads.ts](../../std/threads.ts): under Node an array queue; `send` pushes and the iterator walks it, which C6 makes correct because every sender has already run.
- **Checker.** C1–C7, each with its own `NL` code and registry wording; C6 needs the per-scope spawn order and the may-send/may-receive sets, computed from the task entry's call graph the way P2's shared-write rule is.
- **Codegen.** `send`, the receiving `for...of`, and the sender registration at the join.
- **Tests.** As for `p3-mutex`: a golden `.ll` and `llvm-as`; native round trips (a producer–consumer pipeline whose consumer sums; two producers and one consumer; the parent draining after the join) whose stdout is also what Node prints; one negative per rule, pinned in `tests/wordings/`.
- **Docs.** A `docs/LANGUAGE.md` section "Channels: `Channel<T>`" after the Mutex section; a cookbook entry; the rule and a compiled example in `docs/AI.md`.
- **Goldens.** Regenerated with their tools, never by hand.

## p3-close

**Owns:** `examples/histogram.ts`, `docs/wp29-thread-surface.md`, `docs/MASTER_PLAN.md`, `docs/wp20-threads.md`, `std/README.md`, `docs/BENCHMARKS.md`

Starts after `p3-channel` merges, because it compiles against the shipped features. By then `p3-design` has merged too, so this stage can own wp29 without overlapping a concurrent stage.

- `examples/histogram.ts`: the histogram over enough input to time, one scope of four tasks against the sequential loop, input varying per iteration and a printed checksum. The commit carries `Measured:` with both figures and the noise band (CLAUDE.md).
- Status lines: wp29 header and §4.3, wp20 header, MASTER_PLAN's table rows and "What remains" item 3, std/README.md.

## Out of scope

Channels of non-scalars; `select`; bounded channels; `RwLock`, `Condvar`, `Atomic<T>`; locks inside P1's `f`; non-scalar stores through a guard; detached threads. Each is either declined in wp29 §9 or opened in §11 by this run.

## Merge order

`p3-design` → `p3-mutex` → `p3-channel` → `p3-close`. `p3-design` and `p3-mutex` are developed at once (disjoint Owns); `p3-channel` is developed after `p3-mutex` merges, and `p3-close` after `p3-channel` merges.

## Verification

Per stage, its `verification` line. For any stage touching `src/` or `std/`: `bash scripts/fetch-seed.sh --force` first, read `npm test`'s skip count (undegraded), and read the `wasi` section's skip line.

## Acceptance

Derived from the plan's goal and wp29 §4.3/§11, not from the stages' todos. Each is checked on `main` after the last merge.

1. A program importing `Mutex` and `scope` from `nish/threads`, in which N tasks each add 1 to a guarded counter K times, builds with `nish --link`, runs on more than one thread, and prints N·K; the same file run under Node prints the same.
2. The histogram program (tasks binning shards into a guarded `i32[]`) prints the same bins natively and under Node.
3. Each of R1–R8 and C1–C7 has a program that breaks it and is refused with its own `NL` code, and `node tests/diagnostic-coverage.js --require-coverage` passes.
4. A task that writes shared memory without a guard is still refused, as on 0.18.0.
5. A program in which one task sends 1..N on a `Channel<i32>` and another sums what it receives prints N(N+1)/2 natively and under Node; with two senders, the receiver still sees every value.
6. Spawning a receiver before a sender of the same channel, and a task that both sends and receives on one channel, are each refused with their own `NL` code.
7. `docs/LANGUAGE.md` has the Mutex and Channel sections, `docs/AI.md` has a compiled example of each, and wp29 says P3 is built.
8. `npm run check`, an undegraded `npm test`, `node tests/run.js wasi` and `node tests/run.js performance` pass on `main`.
9. `examples/histogram.ts` exists, and the commit that adds it carries a `Measured:` trailer with the four-task and sequential timings and the noise band.
