---
name: Threads follow-ups
overview: Close what the threads-complete run (ledger #575) left open — the parallelMap scheduling gap to 3x, refusal remedies built from the program, 1-thread string maps, the two arena shapes #703 kept conservative, sibling-scope negatives, a null-accepting guard store, a refreshed Rust/Go table, a balanced CI shard 1, the p256 wasi signal exit and the Node WASI flag's tracking issue. Out of scope — nish:secret and #642.
base: main @ 15a1a97 (contains 50823855, #703)
ledger: see the run's tracking issue
---

# Threads follow-ups

Every stage is one pull request on `feature/threads-followups/<id>`, opened
finished (CLAUDE.md "Definition of done"), reviewed by the lead in adversary
rounds, and squash-merged by the lead. Each stage's commit is its changelog
entry: conventional subject, prose body, `Measured:` with the figures from the
merged head and the noise band, `Refs:`, `Tests:`.

## Common rules for every stage

- Read `.claude/orientation.md`, then the `.claude/` files the stage's subject
  covers (`selfhost.md` before `src/`, `testing.md` before tests, `node.md` and
  `linting.md` before scripts, `typescript.md` + `comments.md` before code).
- Run `bash scripts/fetch-seed.sh --force` before building.
- Gate before opening: `npm run check`, `npm run lint`, `npm run lint:dead`, an
  **undegraded** `npm test` (read the skip line), and for anything touching
  `src/`, `std/` or `runtime/`: `WASI_SYSROOT=/usr node tests/run.js wasi` and
  `node tests/run.js performance`. Read exit statuses, never a piped tail.
- Goldens are regenerated with `node tests/self/goldens.js --update` and `node
  tests/differential/goldens.js --update`, never edited by hand. When another
  `src/`/`std/` PR lands first, merge `main` and regenerate even without a
  textual conflict.
- **Performance claims**: 9 interleaved rounds on a 4-core VM, each binary
  paired with a byte-identical copy; the copy's spread is the noise band; a
  delta is claimed only outside it. Every loop's input changes per iteration and
  its output is folded into a printed, order-sensitive checksum (#575: a XOR
  over a bijection checksummed to 0 and "proved" 3.7x). Medians and ranges.
- **Checker rules**: the same accept/refuse set as `main` unless the stage says
  otherwise; any rule that changes covers `new`, every declarator and `this`
  out of a constructor, each with its own negative (CLAUDE.md).
- **Escape rules**: each escape route gets a negative read after `churn()`,
  natively and under Node at `NISH_NUM_THREADS` 1, 2 and 8; valgrind clean.
- A new diagnostic code: take the next free one on `main` at the time you push,
  and re-check after every merge of `main` (#609 and #654 had to renumber).
- New runtime units are paired in `scripts/build.sh` `halves` and
  `src/run-cache.ts` `runtimeUnits()` in one commit; a declaration added to
  `src/runtime.ts` regenerates `docs/IR_COOKBOOK.md` with `docs/cookbook/regen.sh`.
- User-visible change → the `docs/guide/` page moves in the same PR.
- Do not touch `nish:secret`, `std/crypto`'s Secret rules or #642.

## Stages

### sched — compute-bound parallelMap reaches ≥3x on 4 cores
- **branch** `feature/threads-followups/sched` · **owns** `runtime/runtime-parallel.c`,
  `runtime/nish.h`, `tests/runtime-test.c`, `tests/runtime-budgets.js`,
  `src/parallel.ts`/`src/emit-parallel.ts` only if the grain lives there,
  `bench/par-*.ts`, `bench/run.mjs`, `docs/BENCHMARKS.md`,
  `docs/guide/using-nish/threads.md` (+ goldens it moves) · **depends** —
- Baseline on main (#575 final acceptance): heavy body (16 scramble rounds per
  element, captured `const k`, order-sensitive fold) 2.1–2.3x the loop; 4× work
  2.7x; four independent sequential copies slow each other 1.1–1.3x, so ~3x is
  available. Memory-bound `x * k` 40×2^22: 1.75–1.89x.
- Profile first (`perf record`/`perf stat`, per-worker busy/idle timestamps):
  chunk size and grain (`REGION_COST`), wake latency, work distribution and
  stealing, false sharing on the result array, the join barrier. Fix what the
  profile shows; the PR body shows the profile that justified each change.
- Settle: (a) a single 2^25 map measured 4–13% slower than efbbd8c8 (outside
  the 4% copy band, ranges overlap) — confirm or refute against efbbd8c8 and
  main; (b) workers first-touch their chunk instead of the caller memsetting
  the result (~10% on 40×2^22, not clearly outside noise) — ship only if it
  clears the band.
- **Done**: heavy body ≥3x the loop at `NISH_NUM_THREADS=4`, outside the noise
  band; `x * k` not regressed; 1-thread not regressed; figures recorded in
  `docs/BENCHMARKS.md` and the threads guide. Ceilings in
  `tests/runtime-budgets.js` re-measured with figures in the comment.
- Keep the benchmark programs used (heavy, heavy×4, x*k, single 2^25) in
  `bench/` so the acceptance session can re-run them.

### remedies — refusal remedies built from the program
- **branch** `feature/threads-followups/remedies` · **owns** `src/parallel.ts`
  (messages only), `src/codes.ts` if wording moves, `tests/run.js` (remedy
  check), `tests/wordings/**`, `tests/cases/**` negatives,
  `docs/guide/using-nish/threads.md`, goldens · **depends** —
- NL2484 (`channelArrowMessage`, src/parallel.ts ~4776) is fixed text
  `const sendAll = (ch: Channel<i32>): void => { ch.send(1) }`. Build it from
  the channel's element type and the arrow's real parameter list and body (or
  the channel operation it performs).
- NL2352 (an arrow that pushes onto a captured array) ends with no code. Give
  it the code to write, in the program's names and types.
- NL2536's helper body is a stand-in (`console.log(g.value.<firstField>)`).
  Use the guard's real use where the checker has it.
- Tighten the remedy check in `tests/run.js` so a remedy quoting a concrete
  type the program does not use fails (e.g. compare every type in the remedy
  against the types the program declares/uses; `Channel<i32>` in a
  `Channel<string>` program must fail). Show the tightened check failing on
  main's NL2484 text. Add NL2484 and NL2352 wording cases on `Channel<string>`
  and non-`i32` element types; each remedy, pasted in, compiles and matches
  Node.
- **Done**: accept/refuse set byte-identical to main over `tests/cases`,
  `tests/link` and the guide fences.

### one-thread — 1-thread string maps match the loop
- **branch** `feature/threads-followups/one-thread` · **owns**
  `runtime/runtime-parallel.c`, `runtime/runtime-cross.c`, `runtime/nish.h`,
  `src/emit-parallel.ts`, tests, `docs/BENCHMARKS.md`, guide · **depends** sched
- At `NISH_NUM_THREADS=1`, `parallelMap` over 1M short strings takes 92 ms
  against 89 ms for the loop (an earlier probe: 65.8 vs 57.7). Make a
  one-worker region take the sequential path, or drop the per-element
  keep/transfer cost when no other thread exists.
- **Done**: 1-thread within the noise band of the loop; 4-thread string and
  number figures not regressed; output identical at 1/2/8 threads and Node.

### reclaim-strings — a string[] result passed to a callee reclaims
- **branch** `feature/threads-followups/reclaim-strings` · **owns** `src/escape.ts`,
  `src/attributes.ts`, `src/emit-parallel.ts`, `tests/**`, `docs/LANGUAGE.md`,
  `docs/IR_COOKBOOK.md`, goldens · **depends** —
- `const ws = parallelMap(xs, (x) => \`w${x}\`); return total(ws)` keeps the
  frame's arena; `i32[]` reclaims through its `outlives`/`fillsParam` proof
  (`par_map_reclaim_escapes`'s `reclaims`). Give `string[]` parameters the same
  proof, sound for the strings themselves (a callee that stores an element, or
  the array, anywhere that outlives the call keeps the arena).
- Per CLAUDE.md: each route a `string[]` parameter can leak through (stored in
  a field, a global, a returned value, a closure, pushed into another array,
  `new`, `this` out of a constructor, every declarator) gets a negative read
  after `churn()` natively and under Node at 1/2/8 threads; valgrind clean; an
  RSS-bound fixture that main fails; `.ll` goldens pinning which frames reclaim.

### reclaim-scope — map + scope() frames reclaim; NL2424 under arena() relaxed
- **branch** `feature/threads-followups/reclaim-scope` · **owns** as
  reclaim-strings · **depends** reclaim-strings
- A frame that runs a map and also spawns into `using s = scope()` keeps its
  arena. Inside `using a = arena()`, an array made in the block and handed to a
  scope's `spawn` is refused (NL2424, "stored into memory") although the scope
  joins before the block releases. Make both sound and accepted.
- Same evidence bar as reclaim-strings. Split into two PRs if large.

### sibling — sibling-scope negatives (NL2516)
- **branch** `feature/threads-followups/sibling` · **owns** `src/parallel.ts`,
  `tests/cases/**`, `tests/link/**`, goldens, `docs/LANGUAGE.md` · **depends** —
- Add negatives (or fix the checker if accepted wrongly) for: sharing an
  atomic, a lock or a destination through a constructor's `this`; one scope's
  task returning a value the other scope's task reads. Probe each route's
  siblings in the same PR (via `new`, via every declarator, via a helper call,
  via a field of a field, via an arrow capture). An accepted-wrongly case is
  shown native≠Node before the fix.

### guard-null — nish_guard_keep accepts null
- **branch** `feature/threads-followups/guard-null` · **owns**
  `runtime/runtime-cross.c`, `runtime/nish.h`, `tests/runtime-test.c`,
  `src/parallel.ts`, `tests/**`, `docs/LANGUAGE.md`, guide · **depends** —
- Make `nish_guard_keep` accept null. Then decide with evidence (a probe
  matrix) whether NL2537 can be relaxed for nullable fields; if relaxed,
  positive fixtures storing null and a string through a guard, read back after
  `churn()` across threads, Node parity, plus negatives for what stays refused.

### bench-refresh — the Rust/Go table on current main, plus an atomic histogram
- **branch** `feature/threads-followups/bench-refresh` · **owns** `bench/par-*`,
  `bench/run.mjs`, `bench/README.md`, `docs/BENCHMARKS.md` · **depends** sched,
  one-thread
- Re-take "Data parallelism against Rust and Go" on current main, 3 runs, the
  doc's own method. Add an atomic par-histogram twin (`AtomicI32` per bucket)
  beside the lock-per-value and local-tally versions, with Rust (`AtomicI32`)
  and Go (`sync/atomic`) twins. Measure; do not copy #654's figures.

### shards — CI shard 1 rebalance
- **branch** `feature/threads-followups/shards` · **owns** `tests/run.js`
  (shard split only), `.github/workflows/ci.yml` · **depends** —
- Shard 1 runs ~16 min against 7–10 for the others. Rebalance the `--shard`
  split so the four are within ~20%, without changing what runs (the union of
  the four shards' check names equals the unsharded run's, shown in the PR).
  `LINK_READ_LATER` programs still build in the shard that reads them. Evidence:
  the CI per-shard times on the PR head.

### p256-wasi — p256 agree's intermittent signal exit under wasi
- **branch** `feature/threads-followups/p256-wasi` · **owns** `tests/run.js`
  (wasi section), `examples/wasi-host.mjs`, whatever the root cause is in
  · **depends** —
- `p256 agree`'s wasi build under Node intermittently prints every expected
  line, then exits on a signal (status null, empty stderr). Reproduce with a
  loop (≥50 runs), capture the signal and a core/`--abort-on-uncaught`/`gdb`
  backtrace, and find the root cause: the Node 22 GC/fast-API bug #703 worked
  around with `--no-turbo-fast-api-calls` (InnerPointerToCodeCache during
  fd_write) or another one. Fix it, or apply the same flag with the
  before/after failure counts as evidence. Never retry or skip to go green.

### node-flag — tracking issue for the Node WASI flag
- **branch** `feature/threads-followups/node-flag` · **owns** `tests/run.js`
  (comment only) · **depends** p256-wasi
- File a tracking issue with the minimal repro (`tests/link/par_map_reclaim_escapes`
  under wasi without the flag, the backtrace, the Node version), add a comment
  in `tests/run.js` beside the flag pointing to it, and name the Node version
  whose fix allows dropping it (check the Node changelog / V8 issue). No code
  change beyond the comment unless a fixed Node is already in CI.

## Acceptance (run by a fresh session on the final main, natively and under Node, 4 vCPU)
1. #575 criterion 1 re-run: `parallelMap(xs, (x) => x * k)` with a const local
   `k` compiles, matches Node, and the compute-heavy body is ≥3x the loop on 4
   cores outside the noise band; `x * k` not below 1.75x.
2. #575 criterion 9 re-run: each of the thirteen hand-written refusals ends
   with code in the program's own names and types that, pasted in, compiles and
   matches Node — including NL2484 on `Channel<string>`, NL2352 and NL2536.
3. 1-thread string map within the loop's noise band.
4. `return total(ws)` over a `string[]` map result, and a map + `scope()` frame,
   reclaim (RSS-bound fixtures); `arena()` + scope spawn accepted.
5. Sibling-scope negatives refused; guard null stores per the guard-null verdict.
6. BENCHMARKS table re-taken, atomic histogram present.
7. CI shards within ~20%; p256 wasi has a root cause and a fix or flag with
   evidence; the Node flag has a tracking issue linked from `tests/run.js`.
8. `npm run check`, undegraded `npm test`, `wasi` and `performance` green on
   the final main.
