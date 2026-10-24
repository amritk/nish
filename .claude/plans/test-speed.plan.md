---
name: Test speed — npm test from an hour to well under half
overview: An unsharded npm test takes 40–70 minutes in a 4-core cloud session and about 46 runner-minutes in CI, and sessions are told to run it twice per PR. Over half of it is the tests/link loop, which builds 669 programs one at a time, each with a single-core full-LTO -O3 link. Four PRs — stop sessions running the full suite locally, run the link programs concurrently, make the link itself faster, then build most link programs with a cheaper profile — each with measured figures.
stages:
  - id: session-rule
    title: docs — sessions leave the full suite to CI's shards
    goal: Replace the rule that a session runs the full unsharded npm test twice per PR with targeted local runs plus CI's four shards as the full-suite gate, and move every pointer to the old rule
    verification: npm run lint passes, and grep -rnE "twice per pull request|40–70 min" CLAUDE.md AGENTS.md .claude docs/AI.md prints nothing
    status: pending
    todos:
      - id: rule-claude-md
        content: Rewrite the Definition of done and the Spending tokens bullets in CLAUDE.md so the local gate is npm run check, npm run lint and the touched sections, and an undegraded CI run is the full-suite gate — see Session rule
        status: pending
      - id: rule-agents-md
        content: Update AGENTS.md (Trusting a run, the five merge conditions, the command list) to the same rule, naming how to read the skip count from CI's shard summaries — see Session rule
        status: pending
      - id: rule-guides
        content: Update .claude/testing.md, .claude/orientation.md, .claude/selfhost.md and docs/AI.md item 11 to the same rule, keeping the src/ pre-push wasi and performance runs — see Session rule
        status: pending
  - id: link-parallel
    title: test — run the tests/link programs concurrently
    goal: The tests/link loop runs defaultJobs() programs at a time and reports their checks in corpus order, so a run on N cores takes a fraction of the serial time with identical output
    verification: npm test green and undegraded with the same passed count as base; time node tests/run.js net_ at least 2x faster than at base on the same machine, figures in the commit's Measured trailer
    status: pending
    todos:
      - id: par-buffered-checks
        content: Make one link program's checks collectable and replayable, the way section A reports its cases in corpus order — see Link programs in parallel, Ordered output
        status: pending
      - id: par-pool-loop
        content: Turn the loop at tests/run.js (for const name of linkTests) into a pool of defaultJobs() programs over the existing tests/pool.js — see Link programs in parallel, The pool
        status: pending
      - id: par-serial-set
        content: Keep the programs that need the machine to themselves (fixed ports, timing, PANIC_ONCE_RUNS, thread pool sizing) in a named serial list run after the pool — see Link programs in parallel, What stays serial
        status: pending
      - id: par-shards
        content: Keep --shard, LINK_READ_LATER and DEALT_SECTIONS working, and re-measure tests/shard-costs.json so the shard deal still balances — see Link programs in parallel, Shards
        status: pending
  - id: link-speed
    title: build — a faster link for the speed profile
    goal: Cut the wall clock of the final full-LTO link scripts/build.sh does for --link (about 11 of the 15 seconds of a std/net program) without making shipped binaries slower or larger beyond the noise band
    verification: node tests/run.js performance passes and the size report holds; the link of tests/link/net_relay_f64 measured before and after on the same machine, figures in the commit's Measured trailer
    status: pending
    todos:
      - id: speed-measure
        content: Measure the link's phases (front end, per-module clang -c, final link) and try ThinLTO with parallel backends, -flto-jobs and lld --thinlto-jobs against full LTO on runtime time, size and link time — see Link speed, Options
        status: pending
      - id: speed-apply
        content: Apply the option that wins in scripts/build.sh for the speed profile, or a cheaper link the test suite can ask for if no option keeps release output — see Link speed, Choosing
        status: pending
      - id: speed-docs
        content: Update docs/guide pages, the docs/ARCHITECTURE.md profile table and README lines that state what the speed profile does — see Link speed, Docs
        status: pending
  - id: link-profile
    title: test — most link programs build with a cheaper profile
    goal: Link programs whose subject is not optimisation build with a cheaper profile, while a named set that needs -O3 (metadata soundness, wipes under optimisation, perf, size) keeps the speed profile
    verification: npm test green and undegraded with the same passed count as base; unsharded npm test wall clock measured before and after on the same machine, figures in the commit's Measured trailer
    status: pending
    todos:
      - id: profile-select
        content: Add the one list of link programs that keep the speed profile, with the reason per entry, and build every other link program with the cheaper profile — see Cheaper profile, Selection
        status: pending
      - id: profile-guard
        content: Add a check that the speed-profile list names only real tests/link programs and that every program reading -O3 behaviour is on it — see Cheaper profile, Guard
        status: pending
---

## Context

`npm test` is `node tests/run.js`, one process that runs its sections in order. Figures from the session that wrote this plan, at base `804120e`:

| What | Figure |
| --- | --- |
| CI `test` job, run 40063074019 | Test steps 8.3 + 13.1 + 11.0 + 13.3 = ~46 runner-minutes, ~14 min wall |
| Unsharded, 4-core cloud session | 40–70 min (CLAUDE.md's own figure) |
| [tests/shard-costs.json](../../tests/shard-costs.json) | link programs 1083 s, `shardOne` 482 s, crypto-bench 269 s, self-hosting 126 s |
| `net_` link programs | 188 of 669, 866 s of the 1083 s |
| `net_relay_f64` `--link`, speed profile | 14.6 s (front end ~1.3–7 s, 69 parallel `clang -c` ~3.6 s, final full-LTO link ~11 s on one core) |
| same, `--profile debug` | 2.2 s, same stdout |
| `net_relay_f64` run | 4.4 s wall, 0.35 s CPU (network waits) |

The loop at [tests/run.js](../../tests/run.js) (`for (const name of linkTests)`) awaits each program before the next, so a 4-core box runs one single-core LTO link at a time and sits idle through every program's network waits.

## Approach

- Order of PRs: `session-rule`, `link-parallel` and `link-speed` start at once and touch disjoint files. `link-profile` edits the same loop `link-parallel` rewrites, and its trade-off should be judged on what the other two leave, so it starts after both merge.
- Every speed claim is a `Measured:` trailer with before and after on the same machine and the noise band (`.claude/testing.md` → "A `Measured:` trailer").
- No check is dropped and no program is skipped to buy time. The passed count of an undegraded run stays the same, or the PR body explains every change in it.

| Stage | Owns | Model | Depends on |
| --- | --- | --- | --- |
| `session-rule` | `CLAUDE.md`, `AGENTS.md`, `.claude/testing.md`, `.claude/orientation.md`, `.claude/selfhost.md`, `docs/AI.md` | — | — |
| `link-parallel` | `tests/run.js`, `tests/pool.js`, `tests/shard-costs.json`, `docs/wp10-ci.md` | — | — |
| `link-speed` | `scripts/build.sh`, `tests/runtime-budgets.js`, `tests/perf-baseline.json`, `docs/guide/**`, `docs/ARCHITECTURE.md`, `README.md`, `std/README.md` | — | — |
| `link-profile` | `tests/run.js`, `tests/link/*/args`, `tests/shard-costs.json` | — | `link-parallel`, `link-speed` |

## Session rule

**Owns:** `CLAUDE.md`, `AGENTS.md`, `.claude/testing.md`, `.claude/orientation.md`, `.claude/selfhost.md`, `docs/AI.md`

CI's `test` job already runs the whole suite, in four shards, on every push. A session's local full run repeats it at about four times the wall clock. The new rule:

- Locally, before pushing: `npm run check`, `npm run lint`, and `node tests/run.js <filter>` for every section or program the change touches. A change to `src/` still runs `node tests/run.js wasi` (with `WASI_SYSROOT=/usr`) and `node tests/run.js performance`, and regenerates the goldens, exactly as today.
- The full-suite gate is CI: every `test` shard green on the current head, and its summary's skip count read the way AGENTS.md's "Trusting a run" reads a local one.
- A session may still run the full suite when a change is to the suite itself (`tests/run.js`'s structure, `tests/pool.js`) or when CI cannot answer (a fork PR); say so in the PR body.
- Keep the "Wait for a long run without polling" bullet; it still applies to any long run.

Grep `CLAUDE.md`, `AGENTS.md`, `.claude/` and `docs/` for every statement of the old rule (`twice per pull request`, `40–70 min`, `undegraded \`npm test\``) and move each one. Lines that only describe what `npm test` does stay.

## Link programs in parallel

**Owns:** `tests/run.js`, `tests/pool.js`, `tests/shard-costs.json`, `docs/wp10-ci.md`

### Ordered output

Section A already compiles and runs cases `defaultJobs()` at a time and reports in corpus order. Do the same here: one program's body becomes an async function that records its checks, skips and `WROTE` lines instead of printing them, and the caller replays each program's record in `linkTests` order once it and every earlier program have finished. Output at any width is byte-identical to the serial loop's.

### The pool

Run the programs through [tests/pool.js](../../tests/pool.js) with `defaultJobs()` workers. Replace every `spawnSync` in the body with the async spawn already used for `--emit-panics`, or the event loop blocks and the pool runs one program at a time. The per-module `llvm-as`/`opt` pool inside a program stays; cap its width so the two levels together do not oversubscribe the cores (for example `max(1, defaultJobs() / jobs)`).

Shared state the body touches must be per-program or safe under concurrency: the runtime object cache `scripts/build.sh` keeps for `--link`, `build/test/link/<name>/`, `build/link-panics/<name>/`, and any counter (`irDelegated`). Find each and state in the PR how it is safe.

### What stays serial

Programs that need the machine to themselves run after the pool, one at a time, from one named list with a reason per entry: fixed ports (grep `tests/link/net_*` for literal ports), timing measurements, the `expected.stderr` panic-once runs, and the `thread_`/`par_` runs at `NISH_NUM_THREADS=8`. Start the list from evidence (a program that fails or flakes under the pool), not by guess, and run the full suite at least twice under the pool to find them.

### Shards

`--shard i/n` still deals programs by cost, and `LINK_READ_LATER` programs still run in shard 1 before the checks that read them. Re-measure `tests/shard-costs.json` from a CI run of the new loop, since costs are no longer additive within a shard, and update [docs/wp10-ci.md](../../docs/wp10-ci.md)'s shard figures.

## Link speed

**Owns:** `scripts/build.sh`, `tests/runtime-budgets.js`, `tests/perf-baseline.json`, `docs/guide/**`, `docs/ARCHITECTURE.md`, `README.md`, `std/README.md`

Does not edit `tests/run.js` (the `link-parallel` stage owns it). The suite's existing checks — the performance gate, the `.text*` budgets, `arr_header_tbaa`'s `-O3 -flto` round trips, the wipe checks under `opt -O2` — cover the link. If a new check is essential, say so in the PR body and the `link-profile` stage adds it.

### Options

Measure each on `tests/link/net_relay_f64` and on `node tests/run.js performance`:

| Option | Expected effect |
| --- | --- |
| ThinLTO (`-flto=thin`) with `-Wl,--thinlto-jobs=<cores>` | final link uses every core; code quality usually within a few percent of full LTO |
| Full LTO with `-flto-jobs` / `--lto-partitions` | parallel codegen after one merged optimisation |
| Fewer inputs to the LTO link (the cached runtime objects as native code rather than bitcode) | smaller merged module |

### Choosing

If an option keeps `node tests/run.js performance` and the size report within their noise bands, apply it to the speed profile in `scripts/build.sh` for everyone. If none does, keep the speed profile as it is and add nothing user-visible in this stage; say what each option measured in the PR body, and leave the cheaper link for tests to the `link-profile` stage. Either way the commit carries the figures.

### Docs

If the speed profile changes, update every page that says what it does (`docs/guide/**`, the profile table in `docs/ARCHITECTURE.md`, `README.md`, `std/README.md`, the comments at the top of `scripts/build.sh`).

## Cheaper profile

**Owns:** `tests/run.js`, `tests/link/*/args`, `tests/shard-costs.json`

Starts after `link-parallel` and `link-speed` merge, so it measures what they leave.

### Selection

One list in `tests/run.js` names the link programs that keep the speed profile, with a reason per entry. Every other program is built with the cheaper profile, chosen from measurement: `--profile debug` by default, or the speed profile if `link-speed` made it cheap enough that the difference is inside the noise. Programs whose subject is optimisation stay on speed: TBAA and noalias metadata, `arr_` aliasing domains, wipes that must survive optimisation, SIMD kernels, size and performance figures, and any program whose expected output differs between the two profiles. A program whose `args` already names a profile keeps it.

### Guard

A check that every name on the list is a real `tests/link` program, and that a program carrying a marker of optimisation-dependence (an `expected.ir` naming `!tbaa`, `noalias` or `!alias.scope`, or a wipe check) is on the list.

## Out of scope

- The generic `/feature` skill's worker prompt in the `amritk/ai` repository, which also tells workers to run the full suite twice.
- CI workflow changes (`.github/workflows/**`): the shard count and runner sizes stay as they are.
- Sections other than the tests/link loop (crypto-bench, self-hosting, section A), unless a stage's measurement shows they are now the long pole; then it is a follow-up.

## Tests

- `link-parallel`: the full suite run at least twice under the pool, with identical output order to a serial run (`diff` the PASS lines of both).
- `link-speed`: the existing performance gate, size budgets and `arr_header_tbaa` round trips.
- `link-profile`: the guard check, plus the full suite.

## Verification

```bash
npm run check
npm run lint
node tests/run.js net_          # time it before and after
node tests/run.js performance
npm test                        # undegraded; read the skip count
```
