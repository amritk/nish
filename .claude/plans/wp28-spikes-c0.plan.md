---
name: WP28 — the spikes S2 to S6, then C0, the compat machinery with no feature
overview: Take the four unrun measurements of docs/wp28-compatibility-mode.md §7.1 (S2, S4, S5, S6) as checked-in, re-runnable benches with a verdict each; build S3, the erasure invariant, on a bare `--compat` that accepts nothing; then C0, the allow-list, `nish.compat`, `!nish.compat` in the IR, the implied f64 and the `--help` axes; and record all of it in the note and the roadmap in one last docs PR. No compat feature is built, so no existing `.ll` golden moves and every strict build is byte-identical to today's.
stages:
  - id: s2-async-census
    title: "docs(bench): WP28 spike S2 — async by contagion, counted on real TypeScript"
    goal: A re-runnable census that, on at least two real TypeScript applications, counts the `async` functions and how many of them await something that can block, and a verdict on whether §6.6's decolouring is the common case
    verification: node bench/wp28-s2/run.mjs && npm run lint
    status: pending
    todos:
      - id: s2-census-script
        content: Write bench/wp28-s2/census.mjs on the `typescript` compiler API — per application, every `async` function, classified as blocking at a leaf (awaits a timer, I/O, a network call or an API outside the program), coloured by contagion only (every await reaches only other program functions that never block), or mixed — see S2, The census
        status: pending
      - id: s2-corpus
        content: Pick at least two real applications (not libraries) whose TypeScript source is fetchable from the npm registry, pin each by name@version and tarball integrity in bench/wp28-s2/corpus.json, fetch at run time into a temp directory, check in none of their code — see S2, The corpus
        status: pending
      - id: s2-run-and-verdict
        content: Write bench/wp28-s2/run.mjs (fetch, census, print the table, exit 0) and bench/wp28-s2/README.md with the method, the table, the classification's known false positives from a hand-audited sample of at least 40 functions, and the verdict against §6.6 and §10's "does `async` belong in compat" — see S2, The verdict
        status: pending
      - id: s2-strict-async
        content: State in the README what WP24/WP49's strict `async` (built since the note was written) already accepts of the counted shapes, by compiling a reduced example of each class with build/nish — see S2, What strict already does
        status: pending
  - id: s4-promise-all
    title: "docs(bench): WP28 spike S4 — Promise.all as a fork/join against parallelReduce"
    goal: A measured answer to whether §6.4's second payoff is real — two non-interfering calls joined on `scope()`, as `--async-model threads` would lower `Promise.all`, against `parallelReduce` and the sequential call on the same work
    verification: node bench/wp28-s4/run.mjs && npm run lint
    status: pending
    todos:
      - id: s4-programs
        content: Write the three Nish programs in bench/wp28-s4/ over one kernel at three task sizes — sequential, the hand-lowered fork/join on `using s = scope()`, and `parallelReduce` — each printing the same checksum — see S4, The programs
        status: pending
      - id: s4-harness
        content: Write bench/wp28-s4/run.mjs — builds each with build/nish, runs interleaved with at least 10 samples a side, checks the checksums agree, prints medians, the noise band and the break-even task size — see S4, The harness
        status: pending
      - id: s4-ir-and-verdict
        content: Record in bench/wp28-s4/README.md the figures with the machine and core count, the `.ll` of the fork/join site, and the verdict — at what task size the fork/join beats sequential, and how far it sits from `parallelReduce` — see S4, The verdict
        status: pending
  - id: s5-number-mode
    title: "docs(bench): WP28 spike S5 — the price of --number-mode f64 on the benchmark suite"
    goal: The benchmark suite measured under `--number-mode f64` against the default, per program, with a noise band — the price §5.3 attaches to `--compat`
    verification: node bench/wp28-s5/run.mjs --quick && npm run lint
    status: pending
    todos:
      - id: s5-harness
        content: Write bench/wp28-s5/run.mjs — for every program bench/run.mjs lists, build both modes, run interleaved, report the ratio and noise band per program and the geometric mean, plus instruction counts where bench/instructions.json has the program; `--quick` runs three programs for CI-sized checks — see S5, The harness
        status: pending
      - id: s5-refusals
        content: List every suite program that does not compile or changes its output under f64, with the diagnostic or the diff, rather than dropping it from the mean silently — see S5, What does not survive
        status: pending
      - id: s5-verdict
        content: Record in bench/wp28-s5/README.md the table, the three worst programs with the IR difference that explains each, and the one-line price for §5.3 — see S5, The verdict
        status: pending
  - id: s6-exceptions
    title: "docs(bench): WP28 spike S6 — try/catch by landing pads against a Result desugaring"
    goal: The two candidate lowerings of `try`/`catch` measured on the same programs — happy path, throwing path and code size — and a recommendation for C5
    verification: node bench/wp28-s6/run.mjs && npm run lint
    status: pending
    todos:
      - id: s6-programs
        content: Write three shapes in bench/wp28-s6/ (a hot loop that never throws, a parser that throws 1 in 1000, a deep call chain that unwinds 32 frames), each as the Nish `Result` program the desugaring would produce and as hand-written LLVM IR using `invoke`/`landingpad` on the Itanium unwinder — see S6, The programs
        status: pending
      - id: s6-harness
        content: Write bench/wp28-s6/run.mjs — `llvm-as` every hand-written `.ll`, build both sides at the release profile, run interleaved, check outputs agree, print time per shape, the noise band and `.text` plus unwind-table size — see S6, The harness
        status: pending
      - id: s6-constraints
        content: Record what landing pads would cost outside the timing — the unwinder dependency per target (linux, macOS, wasi, the freestanding profile), what `nounwind` on every function buys today and which attributes the fixpoint would lose — see S6, What the timing does not show
        status: pending
      - id: s6-verdict
        content: Write bench/wp28-s6/README.md with the figures and a recommendation for C5, stated as a rule a reader can check against the table — see S6, The verdict
        status: pending
  - id: s3-erasure
    title: "feat(cli): a bare --compat that accepts nothing, and the erasure invariant that holds it (WP28 S3)"
    goal: "`--compat` parses and changes nothing, and a test proves it across the corpus — every positive case emits byte-identical IR with the flag, every `reject_*` case rejects with the same code and words"
    verification: node tests/run.js compat-erasure && node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint
    status: pending
    todos:
      - id: s3-flag
        content: Parse a bare `--compat` in src/compile.ts and carry it in src/options.ts as the dialect; it admits no construct and changes no lowering; `--compat=<anything>` is a usage error in this stage; list it in `--help` as accepting nothing yet — see S3, The flag
        status: pending
      - id: s3-harness
        content: Write tests/compat-erasure.js — over every tests/cases program, compile with and without `--compat` and compare the `.ll` byte for byte (positive) or the exit code, diagnostic code and message (reject); print the counts and fail on the first difference with both outputs — see S3, The harness
        status: pending
      - id: s3-wire
        content: Add the `compat-erasure` section to tests/run.js so every CI shard deal includes it, cost-dealt through tests/pool.js; report its wall time in the PR body — see S3, In the suite
        status: pending
      - id: s3-negative
        content: Prove the harness can fail — a self-test that feeds it a compiler wrapper which alters one IR line and one diagnostic word under `--compat`, and expects both to be caught — see S3, The negative test
        status: pending
      - id: s3-docs
        content: Add `--compat` to docs/guide/using-nish/cli.md and docs/LANGUAGE.md's flag list as a dialect flag that accepts nothing yet, regenerate docs/reference/ and tests/self/goldens/checked/ — see S3, Docs
        status: pending
  - id: c0-machinery
    title: "feat(cli): compatibility mode's machinery with no feature — the allow-list, nish.compat and the dialect in the IR (WP28 C0)"
    goal: Everything a compat feature will plug into, with zero features — `--compat=<list>` against an empty registry, `nish.compat` in the root manifest as the program's ceiling, `!nish.compat` in every module of a compat build, the implied `--number-mode f64` with its priced override, and `--help` grouped by axis — with S3's invariant still holding
    verification: node tests/run.js compat && node tests/run.js compat-erasure && node tests/run.js performance && node tests/run.js wasi && node tests/nish-cmp.js && npm run check && npm run lint && node scripts/gen-reference.mjs --check
    status: pending
    todos:
      - id: c0-registry
        content: Add the feature registry (empty) and the allow-list parse — bare `--compat` is every built feature, `--compat=a,b` exactly those, an unknown name is an error that lists the known ones — see C0, The registry
        status: pending
      - id: c0-manifest
        content: Teach src/manifest.ts the `compat` key of the root `"nish"` object (`true` or an array of feature names, written once, any other value refused); the CLI flag overrides it; an unknown key is still NL3036 — see C0, nish.compat
        status: pending
      - id: c0-ceiling
        content: Enforce the root's list as the program's ceiling in src/compilation.ts — a dependency whose manifest asks for a feature the root does not allow is an error naming the dependency, the module and the feature — see C0, The ceiling
        status: pending
      - id: c0-metadata
        content: Emit one `!nish.compat` named metadata node in every module of a compat build, carrying the feature list and the number mode, and one line in `--emit-checked`; a strict build emits neither, so no golden moves — see C0, The dialect in the artifact
        status: pending
      - id: c0-number
        content: "`--compat` implies `--number-mode f64`; an explicit `--number-mode i32` beside it wins and is reported once in the `performance` class under a new NL9xxx code, silenced by `--no-warn-performance` — see C0, number"
        status: pending
      - id: c0-help
        content: Group `--help` by the axes of §5.2 (Dialect, Build, Output, Diagnostics, Policy), every flag under exactly one, no flag renamed — see C0, --help
        status: pending
      - id: c0-erasure
        content: Restate the invariant in tests/compat-erasure.js for the two exceptions — `--compat --number-mode i32` equals strict, and `--compat` equals `--number-mode f64`, each modulo the one `!nish.compat` node — and add the `compat` section to tests/run.js for the flag, manifest, ceiling, metadata and number cases, with a negative test for each refusal — see C0, Tests
        status: pending
      - id: c0-docs
        content: Write the guide page docs/guide/using-nish/compat.md with its route, update cli.md, LANGUAGE.md's flag list and the NL3036 wording that lists the accepted keys, regenerate docs/reference/ and the goldens — see C0, Docs
        status: pending
  - id: record
    title: "docs: WP28's spikes and C0 recorded in the note and the roadmap"
    goal: The design note states what S2 to S6 measured and what each decides, the roadmap pages and index show S2, S3 to S6 and C0 done, and every place that says WP28 is unbuilt or waiting on acceptance says what is true now
    verification: node docs/check-links.mjs && npm run lint
    status: pending
    todos:
      - id: record-note
        content: In docs/wp28-compatibility-mode.md, replace the status header, mark S2 to S6 done in §7.1 with one result line each, add §7.5 to §7.9 giving each spike's figures, noise band and verdict from its bench README (linked, not copied in full), and correct §6.2's "strict rejects `async`" for WP24/WP49 — see Record, The note
        status: pending
      - id: record-open
        content: In §10, strike what the spikes and C0 settled and leave each remaining question with the measurement that now bears on it; do not decide for the owner whether S2 retires C3 — state the figure and the two readings — see Record, The open questions
        status: pending
      - id: record-roadmap
        content: Tick S2, S3 to S6 and C0 in docs/roadmap/wp28-compatibility-mode.md, set State to In progress and Done to 5 of 13, move Next to C1, move WP28 out of "Waiting on a decision" in docs/roadmap/index.md and fix its table row, and update docs/roadmap/wp33-round-trip.md's Next (R6 stays unticked) — see Record, The roadmap
        status: pending
      - id: record-mirrors
        content: Update every mirror in the same PR — docs/wp33-round-trip.md §9, docs/README.md, docs/MASTER_PLAN.md — and add the four bench directories to bench/README.md with the command that runs each — see Record, The mirrors
        status: pending
---

# WP28 — the spikes S2 to S6, then C0

## Context

`docs/wp28-compatibility-mode.md` proposes a porting dialect, `--compat`, and
gates it on six measurements. S1 is taken (§7.4). The roadmap page shows 2 of
13 done; the next unticked items are S2, then S3 to S6, then C0. This plan
covers exactly those and stops: C1 onward depend on what the spikes say (S2 may
retire C3, S6 picks C5's lowering), so they are a later run's plan.

Three facts the note predates, which every stage must respect:

- **Strict `async` exists.** WP24/WP49 built `async` functions and `await`
  in strict; a promise is never a value. §6.2's "strict: rejected" row is
  stale. S2 and S4 measure against what is built, and `record` corrects it.
- **There are 2605 `reject_*` cases**, not 946.
- **`--number-mode` exists** (`src/compile.ts`); `--async-model` does not and
  is not built here.

WP33's R6 is this whole package. It stays unticked after this run.

## Approach

```
s2 ─┐
s4 ─┤
s5 ─┼──────────────────────────────┐
s6 ─┘                              ├─ record
s3 ───────── c0 ───────────────────┘
```

- The four bench spikes touch only their own new directory, so they run at
  once and merge in any order.
- S3 and C0 both live in `src/` and `tests/` and regenerate the same goldens.
  C0 starts when S3 has merged.
- **No spike or build stage edits the note, the roadmap or `bench/README.md`.**
  `docs/roadmap/index.md` conflicts on almost every merge of `main`, so one
  stage owns every shared doc and lands last, synced just before its merge.
  This bends "tick the box in the PR that lands the stage" on purpose; each PR
  body says so.
- With `--max-slices 4`: S3, S2, S5, S6 start; S4 takes the first free slot.

**Why S3 carries the flag.** §7.1 defines S3 as the erasure invariant "run
against the corpus with a feature-less `--compat`", so the spike needs a flag
that parses. S3 adds the bare flag as a pure no-op (no f64, no metadata) so the
invariant is byte-for-byte with no exceptions; C0 then adds the two documented
exceptions and restates the test for them.

**Verifying a no-op.** For S3 and C0, every claim that a flag changes nothing
is settled by compiling both forms and diffing the `.ll`, never by reading the
code. PR bodies show the diff command and its empty output.

| Stage | Owns | Model |
| --- | --- | --- |
| s2-async-census | `bench/wp28-s2/**` | lead |
| s4-promise-all | `bench/wp28-s4/**` | lead |
| s5-number-mode | `bench/wp28-s5/**` | lead |
| s6-exceptions | `bench/wp28-s6/**` | lead |
| s3-erasure | `src/**`, `tests/**`, `docs/guide/**`, `docs/LANGUAGE.md`, `docs/reference/**`, `scalar.config.json` | lead |
| c0-machinery | the same globs as s3-erasure, after it merges | lead |
| record | `docs/wp28-compatibility-mode.md`, `docs/wp33-round-trip.md`, `docs/roadmap/wp28-compatibility-mode.md`, `docs/roadmap/wp33-round-trip.md`, `docs/roadmap/index.md`, `docs/README.md`, `docs/MASTER_PLAN.md`, `bench/README.md` | lead |

No stage is `Model: sonnet`: each spike designs a measurement, and the record
stage states verdicts.

## S2 — async by contagion

**Owns:** `bench/wp28-s2/**`

**The census.** `census.mjs` parses a source tree with the `typescript`
package already in `devDependencies`. A function is *blocking at a leaf* when
it awaits a call that resolves outside the program (a `node:` or dependency
import, a global such as `fetch` or `setTimeout` wrapped in a promise, a
`new Promise`). It is *coloured by contagion* when every `await` in it reaches
only program functions, and none of those is blocking, transitively. Anything
the resolver cannot follow (a dynamic call, an interface method) is *unknown*
and reported as its own column, never folded into either side.

**The corpus.** Applications, not libraries: a library's `async` surface is
its API. Pin by `name@version` and the registry's `integrity`. Fetch with
`npm pack` into `os.tmpdir()`. Nothing third-party is committed
(`.claude/licensing.md`).

**The verdict.** §6.6 claims most application `async` is contagion. State the
fraction with the unknown column as the error bar, and what it means for §10:
a clear majority supports C3; a minority argues for C4 alone.

**What strict already does.** One reduced example per class, compiled with
`build/nish`, exit code and diagnostic recorded.

## S4 — Promise.all as a fork/join

**Owns:** `bench/wp28-s4/**`

**The programs.** `--async-model threads` is unbuilt, so the fork/join is
written by hand as the lowering would emit it: two tasks on
`using s = scope()` (`std/threads.ts`), joined, results combined. The kernel
is pure (no shared writes), sized so one task takes about 1 µs, 100 µs and
10 ms.

**The harness.** Interleaved A/B/C, medians, the noise band as the spread of
the baseline against itself (`.claude/testing.md` → "A `Measured:` trailer").

**The verdict.** The break-even size is the finding: below it a `Promise.all`
under threads is a pessimisation and the lowering needs a size rule.

## S5 — the price of f64

**Owns:** `bench/wp28-s5/**`

**The harness.** Reuse `bench/run.mjs`'s program list by importing it or
reading the same source of truth; do not copy the list. Do not edit
`bench/run.mjs` or `bench/instructions.json`.

**What does not survive.** A program that fails to compile or prints something
else under f64 is a finding about §5.3, reported by name.

**The verdict.** One sentence a user can be told: "`--compat` costs N× on
integer-heavy code, within noise on the rest", with the table behind it.

## S6 — exceptions two ways

**Owns:** `bench/wp28-s6/**`

**The programs.** The `Result` side is ordinary Nish. The landing-pad side is
hand-written `.ll` (the compiler has no `invoke`), linked against the
toolchain's unwinder with a minimal personality; say which one and why.

**The harness.** Every hand-written `.ll` passes `llvm-as` before it is timed.

**What the timing does not show.** Every function is `nounwind` today. The
README states what that buys (run `opt -O2` on one shape with and without it
and diff) because that is the standing cost landing pads would add to code
that never throws.

**The verdict.** A recommendation with its rule, for the owner to accept.

## S3 — the erasure invariant

**Owns:** `src/**`, `tests/**`, `docs/guide/**`, `docs/LANGUAGE.md`, `docs/reference/**`, `scalar.config.json`

**The flag.** One boolean on the options record. No lowering reads it.
`src/` may not use a construct the seed lacks (`.claude/selfhost.md`).

**The harness.** Model it on "performance: `--no-warn-performance` … leaves
the IR byte-identical" (`tests/run.js`), at corpus scale. Skip counts are
printed and must be zero for missing tools.

**In the suite.** It compiles the corpus twice more, so measure it and deal
its cost in `tests/pool.js`. A change to the suite's structure runs the full
`npm test` locally once (`CLAUDE.md` → Definition of done); say so in the PR.

**The negative test.** A harness that cannot fail proves nothing.

**Docs.** The flag is user-visible, so the guide and flag list move with it.

## C0 — the machinery, zero features

**Owns:** the same globs as S3. Starts after S3 merges.

**The registry.** One table of feature names, empty. Later stages add a row.
Nothing unused may be exported (`npm run lint:dead`).

**nish.compat.** Beside `noPanic`, `capabilities` and `host` in
`src/manifest.ts`; read from the root manifest only, like the capability
policy.

**The ceiling.** With no features the only violation is a dependency that
asks for compat (`true` or any list) under a strict root. Test that one.

**The dialect in the artifact.** `Module.addNamedMetadata` in `src/ir.ts`.
Verify "absent for strict" by diffing a strict `.ll` before and after the
change: empty.

**number.** The one place compat changes meaning. The override warning takes
the next free NL9xxx code in `src/codes.ts` (append only; bump `RULE_COUNT`).

**--help.** Regrouping only. `--plain` keeps its name; the rename §5.2
proposes is out of scope.

**Tests.** nish-cmp must show no corpus IR moved; no `DECLARED` entry is
expected.

**Docs.** A new guide page with its route; `docs/reference/` regenerated.

## Record

**Owns:** the note, both roadmap pages, the roadmap index, `docs/wp33-round-trip.md`,
`docs/README.md`, `docs/MASTER_PLAN.md`, `bench/README.md`. Starts when every
other stage has merged or escalated; a spike that escalated is recorded as
unrun, with the reason.

**The open questions.** The owner decides. The note states figures.

**The roadmap.** Sync `main` just before merging (`npm run sync-main`);
`docs/roadmap/index.md` will have moved.

## Out of scope

C1 onward; `--async-model`; the `--plain` rename; what the interop emitters do
with a compat program (no compat construct exists to emit); a per-dependency
ceiling beyond §3's rule; ticking WP33's R6.

## Verification

- Local, every stage: `npm run check`, `npm run lint`, the stage's command.
- `src/` stages also: `node tests/run.js wasi` (with `WASI_SYSROOT=/usr`),
  `node tests/run.js performance`, `node tests/nish-cmp.js`.
- The full suite is CI's eight shards on the PR head.
