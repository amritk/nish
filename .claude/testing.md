# Writing Tests

You write tests that are clear, maintainable, and thorough. You optimize for
readability and reliability. Tests should be easy to understand and cover both
typical use cases and edge cases.

## Setup

There is no unit-test framework here — no Vitest, no `bun test`, no Jest. The
suite is `tests/run.js`, a plain Node script that `npm test` runs after
`npm run build`, printing one `PASS` / `FAIL` line per check. Almost every test
is **data, not code**: a source file next to the output it must produce.

- **Golden cases live in `tests/cases/`**, one `<name>.ts` per case, discovered
  automatically. The sidecar files decide what the case asserts:
  - `<name>.ll` — the expected IR with the module header stripped. A missing
    golden is written by `npm run test:update`; a wrong one is a failure.
  - `<name>.err` — one expected message fragment per line; the compile must
    fail with exit 1 and every fragment must appear. No `.ll` is needed.
  - `<name>.out` — expected stdout once the case is linked with `<name>.c`
    (or `tests/driver.c`, which prints `test()`) and both runtime `.c` files
    (`runtime/runtime.c` and `runtime/runtime_os.c`) and run. A source with
    `export const main` (or the legacy `export function main`) is linked without
    the driver.
  - `<name>.args` — extra CLI flags, whitespace separated.
  - `<name>.env` — the environment the run is given, one `NAME=value` per line,
    layered over the inherited one (blank lines and `#` comments ignored;
    `NAME=` sets an empty value, which is *set*). A case that calls `getenv`
    has no other way to pin its answer, because the language has no `setenv`.
    `tests/differential/lib.js` reads the same file, so the native binary and
    the Node rewrite are handed the same environment.
  - `<name>.stdout` — for dump flags (`--emit-ast`, `--emit-checked`): the
    compiler's stdout is the golden and no IR is written.

  One thing about a case is decided away from the case, in
  `tests/self/stage1_only.txt`: whether it is **stage1-only**. A case named
  there is compiled by a stage1 binary built out of `self/` rather than by
  stage0, and every stage0 oracle counts it as declared rather than skipping
  it — which is how a construct can be implemented in `self/` alone instead of
  twice (`docs/wp19-stage0-retirement.md` §1a). The file's header is the
  contract; registering a case removes the second implementation and none of
  the tests below.
- **Naming is by family prefix**, matching the module that owns the construct:
  `cf_*` control flow, `cls_*` classes, `str_*` strings, `arr_*` arrays,
  `mem_*` memory, `math_*` / `div_*` / `i64_*` / `f64_*` numerics, `io_*` and
  `process_*` builtins, `entry_*` / `export_*` modules and the `main` wrapper,
  `opt_*` optimisation flags, `dbg_*` debug info, `dump_*` the dump flags, and
  `reject_*` for a validator or checker rejection (over half the suite). Pick
  the prefix the neighbours use.
- **Whole programs go under `tests/link/<name>/`** when the point is the
  `--link` path, linkage, or `--strict-exports`: expected exit code, stdout,
  and `expected.ir` fragments.
- **The pipeline checks are code**, in `tests/run.js` itself and
  `tests/runtime_test.c`, `tests/layout/`, `tests/ir/`: runtime unit tests,
  the inline allocator against the C arena layout, size and wasm profiles,
  interop, exit codes, packaging. Add one there only when a golden cannot
  express the property (a byte budget, a vectorisation check, an ABI
  agreement).
- **Differential tests** (`tests/differential/`) compile every whole program
  natively and rewrite it to JavaScript from the checker's own types, then
  compare stdout, exit status and signal byte for byte under Node.
  `npm run test:diff` runs the full set; `node tests/differential/fuzz.js
  --count 200` a larger random batch, printing the seed so a failure
  reproduces with `--seed <s> --count 1`. A discrepancy that is a deliberate
  semantic difference (documented in `docs/wp13-differential.md`) goes in
  `known-failures.txt`; anything else is a bug.
- **Minimize mocking.** There is nothing to mock: the compiler is a pure
  function from source to IR, and the runtime is exercised by running real
  binaries. Prefer a smaller golden to a stub.
- **The golden cases are compiled in process, not one command per case.**
  A `node dist/index.js <case>.ts -o out.ll` spends about 634 ms, of which
  1.5 ms is compiling and ~473 ms is `import ts from "typescript"`; paid once
  per case that was almost all of section A's wall clock. `tests/batch_worker.js`
  drives `new Compilation({})` / `addRoot` / `check` / `emit` directly, sixty-four
  cases to a process, and `tests/batch_compile.js` spawns those workers and hands
  `run.js` a result in the shape `spawnSync` answers in. Three things to know
  before touching it:
  - **A `.args` flag has to be mapped.** `planOptions` in the worker turns the
    sidecar into `CompilerOptions`. A flag it does not know is *not* ignored: the
    case falls back to a real CLI spawn, so adding a flag costs performance
    rather than correctness. Adding it to the map is the whole change.
  - **The input path is handed over exactly as written.** `source_filename`
    records it and `-g` puts it in a `DIFile`, so resolving or relativising it
    would move every golden (`docs/wp19-stage0-retirement.md` §A3).
  - **The fast path is gated on the slow one.** Every run compiles one case per
    shape — each distinct `.args` spelling, each sidecar a case asserts through,
    with and without a second module — through the CLI as well and compares the
    exit status, stdout, stderr and the bytes of the module. `node tests/run.js
    --verify-batch` does that for the whole corpus, and CI's `batch-parity` job
    runs it on every pull request. Do not make section A faster without keeping
    that comparison able to see it.
- **The C a case links against is built once per run, not once per case.**
  `runtime/runtime.c`, `runtime/runtime_os.c` and `tests/driver.c` become object
  files on their first use and every `.out` case links against those: measured,
  470 ms a link became 91 ms, with 362 ms paid once. `runtimeObjects(defines)`
  owns them and `linkNative` is the one place a case is linked.
  - **`defines` is the cache key and the whole of what can vary.** Today that is
    `-DNISH_THREADS=1` alone, which puts `nish_arena` in thread-local storage. A
    case that needs a differently built runtime therefore cannot be handed this
    one — and that is checked, not trusted: `runtime objects: a --threads module
    refuses to link against the default runtime` fails if the key ever stops
    mattering. A wrong-but-fast link is worse than a slow one.
  - **The objects are what clang would have produced inline, byte for byte.**
    The other `runtime objects:` check relinks a case from the sources with the
    exact command line this suite used before and compares the binaries.
  - **Three links still name the sources on purpose**: the two runtime unit
    tests, whose subject *is* that the translation units compile warning-free
    together, and the layout link, whose `-Wall -Wextra -Werror` covers the
    runtime as well as `structs.c`. Caching those would remove a check, not an
    overhead.
  - Nothing survives a run: the objects are rebuilt on first use in each
    process, so an edited `runtime.c` can never be linked against a stale one.
- **Toolchain-dependent checks skip, never fail, without LLVM.** `run.js` probes
  for `llvm-as` / `clang` and skips assembly, linking and native runs when they
  are missing. Do not write a check that assumes a tool is present; gate it the
  way the existing ones are — and report the skip through `skip(reason)`, not
  `console.log`, so it is counted. The run ends `N passed, M failed, K skipped`
  and prints a `DEGRADED:` banner when the toolchain is what was missing;
  that count is how a reader knows what a green run was worth.

## What every construct ships with

From `docs/MASTER_PLAN.md` §7 and the checklist in `docs/ARCHITECTURE.md`; a
PR adding a construct is not finished without all of them:

1. A golden `.ll` that passes `llvm-as` (the runner assembles every compiled
   case).
2. A native round trip: a `.out` file, driven by `tests/driver.c` or an
   `export const main`.
3. At least one negative test: a `reject_*.ts` + `.err` naming the exact
   message.
4. `.args` for any flag the case depends on.
5. Its `docs/LANGUAGE.md` rule, citing the case by name, and a cookbook entry.
   A cookbook entry is compiled by stage0 (`docs/cookbook/regen.sh`), so a
   stage1-only construct's entry waits until the seed has it — one release —
   and the case in `tests/cases/` is what pins the lowering until then.
6. Both implementations, or a line in the register. A construct written in
   `src/` *and* `self/` is compared by the oracles byte for byte, which is the
   strongest thing this repository can say about a lowering; a construct
   written in `self/` alone is named in `tests/self/stage1_only.txt` and is
   proved by its golden and by `nish-cmp.js` instead. Either is a decision
   someone makes on purpose. What is not allowed is the third thing — a
   construct in `self/` alone and *not* registered — because the oracles would
   then skip its case in silence and the corpus would shrink without anyone
   deciding it should.
7. A case that *reaches* each new wording, not only a code for it.
   `tests/diagnostic_coverage.js` compiles the negatives, the `perf_*`
   positives and `tests/wordings/`, reads the code out of every `--json`
   object, and requires each registry code to be provoked or named in
   `tests/wordings/unreachable.txt` with a reason; `npm test` runs it. After
   R6 a wording no case reaches is proved by nothing at all, since the
   comparison with stage0 is what proves it today
   (`docs/wp19-stage0-retirement.md` §2B).
8. A diagnostic code, if the construct can be refused: run
   `node scripts/gen-diagnostic-codes.mjs` so `src/codes.ts` and `self/codes.ts`
   pick the new message up. The generator appends and never renumbers, and
   `npm test` fails while either file is stale. A message built entirely out of
   interpolations gets `NL0000`; giving it a code means giving it words of its
   own, not editing the table by hand.

A golden is only worth what a human can read in it: keep each case small and
about one thing, and hand-check the IR before committing it rather than
accepting whatever `test:update` wrote. A golden that changes for an unrelated
construct is a regression until proven otherwise.

Structural guards (the runtime's two `.text*` budgets — every `.text*` section
of `clang -Oz -c runtime/runtime.c` summed, and the same for
`runtime/runtime_os.c`, which is neither file's source size and neither is
`size`'s text column; they are separate so that a new syscall wrapper cannot
move the core's ceiling — the runtime symbol table agreeing across
`runtime.ts`, `runtime.c` and `nish.h`, and `opt -O2` vectorising `cf_sum_loop`)
pin properties that have been broken before. When one fails, the change is what
is wrong, not the test. Never delete a guard, and never move a number to turn a
red line green; a budget is raised only deliberately, by a commit that carries
the fresh measurement and the reason for it (`docs/wp7-runtime.md`
§"Runtime additions and budget").

## Testing a Nish program in Nish

Everything above is the harness that tests the *compiler*. A program the
compiler produced can also test itself, with [`std/testing`](../std/README.md):

```typescript
import { Suite } from "nish/testing";

export const main = (): number => {
  const t = new Suite("stats");
  t.eqI32("sumOf", sumOf([3, 9, 4, 9]), 25);
  return t.done();            // 0 when nothing failed, 1 otherwise
};
```

It prints the `PASS` / `FAIL` / `SKIP` lines and the `N passed, M failed, K
skipped` summary this suite prints, for the reason this suite counts skips: a
green run that skipped half its checks should not look like one that proved
everything. Two rules of the language shape how it is used, and both are worth
knowing before writing a case with it:

- **A function is not a value**, so there is no `test(name, () => ...)`. The
  suite is driven by straight-line calls.
- **Every assertion answers a `boolean`**, because a failure cannot throw and be
  caught: an out-of-range index *panics* and ends the process, so a check that a
  later read depends on is a branch —
  `if (!t.eqI32("len", a.length, 3)) { return t.done(); }`.

The assertions are `ok`, `eqBool`, `eqI32`, `eqI64`, `eqF64`, `nearF64` and
`eqStr` for a value, and three for text a harness produces: `contains` for a
fragment of a captured stream, `containsAll` for an expectation file that holds
one fragment per line (blank lines ignored, the first missing one named), and
`eqLines` for a generated text against a golden, which reports the first
differing line rather than printing both. `pass`, `fail` and `skip` are public
for a check of your own shape, and `skip` is how a check that did not run stays
counted.

Use it for a whole program whose behaviour is the point (`tests/link/`), not for
the golden cases: a `tests/cases/<name>.ts` asserts through its `.ll` and `.out`
sidecars, and a suite inside one would put the assertion in the program instead
of in the data. `tests/link/std_testing` and `tests/link/std_testing_fail` are
the two cases that pin the library itself, one per outcome.

### The golden runner in Nish

[`tests/nish/run.ts`](../tests/nish/run.ts) is this suite's section A written in
the language. It discovers `tests/cases/` with `readdirSync`, spawns the compiler
per case, honours `.args`, `.argv`, `.env` and `.stdout`, diffs the emitted IR
against the golden line by line, assembles every module with `llvm-as` and
verifies it with `opt -passes=verify`, links and runs the cases with a `.out`,
walks the `tests/link/` programs the same way, and reports through a `Suite`. It
answers 1 when any check failed, and names its slowest cases from
`monotonicNanos`.

```bash
npm run test:nish                 # the whole corpus, about five minutes
build/nish-runner pop             # only cases whose name contains "pop"
```

`npm test` builds it and runs it over the `pop` cases — one golden, one native
round trip and three rejections — because it spawns a compiler per case and a
second full pass would double the suite. The full pass runs in CI as its own
parallel job (`.github/workflows/ci.yml`), which is what keeps it honest: a
harness nobody runs is a harness that rots. It is also the only place
`readdirSync`, `spawnSyncTo` and `monotonicNanos` are exercised together on a
real workload.

Two POSIX utilities stand in for builtins the language does not have, and both
are deliberate: `env(1)` gives a child its `.env` (including `env -u` for a name
the sidecar unsets, which is why a developer's own exported variable cannot leak
into a golden), and one `rm -rf` empties the link output directory, because a
stale module from an earlier run would otherwise be listed and compared as though
this run had emitted it. Each is a counted skip when the utility is missing
rather than a silent pass.

It is not a replacement for this file's subject, and what it leaves out is now
short enough to name: the cross-module `declare`/`define` attribute agreement,
which needs a regular expression the language does not have, `UPDATE_GOLDENS`,
which it must never do, and every pipeline check — interop sidecars, layout,
wasm and napi profiles, packaging, the self-hosting oracles, the fourteen parity
flag variations. `tests/run.js` is still what proves the compiler; the runner
proves the language can host a harness. Its own header comment is the accurate
description of what it covers; keep the two in step.

### The CLI contract in Nish

[`tests/nish/cli.ts`](../tests/nish/cli.ts) is the second Nish harness, and it
covers the one thing the runner deliberately does not: the **machine-readable
surface** (orientation rule 7, `docs/wp12-release.md`). `--help` on stdout with
exit 0 against the same text on stderr with exit 2, every advertised flag named
in the usage, one flat `--json` object per diagnostic with a stable `code` and a
`severity` a tool filters on, the `wrote <file>` progress line on stderr so
stdout carries objects and nothing else, and each exit-code band — 0, 1, 2, 3 and
70 — driven from outside the compiler.

```bash
npm run test:cli                  # the default compiler, 69 checks in about nine seconds
build/nish-cli build/nish         # the same contract, against the self-hosted one
```

The point is not a second implementation of the WP12 block in `tests/run.js`. The
promise `--json` makes is made *to a program that reads the output*, and this is
that program: it reads the objects with `std/json`, the streams with `std/text`,
and the version it expects from `--version` out of `package.json` with the same
`jsonField`, so the expectation cannot drift from the release. Unlike the golden
runner it runs in full on every `npm test`, because it spawns eighteen compilers
rather than four hundred. The three `NISH_SIMULATE_ICE` checks are stage0's — the
hook is stage0's, and stage1 answers 70 with the same report
([`self/ice.ts`](../self/ice.ts)) — so they are counted skips when the compiler
under test is not a Node entry point.

## Style & Best Practices

- Clarity first. Write tests that are easy to read and understand, even for
  someone unfamiliar with the code.
- Think like a QA engineer.
- Cover all important code paths.
- Test both the happy path and error handling: for a compiler that means the
  IR it emits *and* the message it prints when it refuses.
- Add tests for edge cases and potential failure scenarios: integer wrap,
  `MIN / -1`, an empty array, a `null` narrowing that must not survive a
  reassignment, an import cycle.
- Comments are welcome when they add value. A one-line comment at the top of a
  case saying *why it exists* (which rule, which bug) is the norm; do not
  narrate what the code does.
- Avoid repeating what the code already makes obvious.

## Running a subset

```bash
node tests/run.js locals            # only cases whose name contains "locals"
npm run test:update                 # write missing .ll goldens, and tests/self/goldens/
npm run test:diff                   # the full differential set
node tests/differential/fuzz.js --count 200
node tests/self/goldens.js          # the stage1 goldens alone, ~13 s
npm run test:cli                    # the CLI contract, through the Nish harness
```

`tests/self/goldens/` is the other family of checked-in golden here: the
`--emit-checked` dump of the whole corpus, and the stdout of the three driver
programs, as **stage1** prints them (WP19 gate G2.4). They exist because the
four oracles that presently prove those outputs compare stage1 with stage0 and
will prove nothing once `src/` is deleted. `npm run test:update` rewrites them
along with the `.ll` goldens, and `node tests/self/goldens.js --update` alone;
read `.claude/selfhost.md` before regenerating one, because regenerating from
the wrong compiler is how a golden records a bug as the specification.

`tests/wordings/` is the third: one small program per **diagnostic code**,
named for the code it pins (`nl2200_empty_import_list.ts`), with the whole
message in its `.err`. It exists because a `reject_*` case proves a rule and a
wording gets proved only where somebody happened to write one down — when the
gap was measured, 176 of the registry's 351 codes were reached by nothing that
outlives stage0 (WP19 §2B, "The wording gap"). The registry grows, so the
number to trust is the one the tool prints, not one written down here.
`tests/diagnostic_coverage.js` runs it, and requires every registry code to be
**either provoked by a program or named in `tests/wordings/unreachable.txt`
with a reason**, so a new diagnostic arrives with a case or with a sentence
saying why it cannot have one.

```bash
node tests/diagnostic_coverage.js                       # the default compiler
node tests/diagnostic_coverage.js --compiler build/nish --strict-refusals
node tests/diagnostic_coverage.js --report              # every code, covered or not
node tests/diagnostic_coverage.js --update              # rewrite the .err pins
```

Two lists sit beside the corpus and both shrink rather than grow:
`parser_refusals.txt` names the cases whose wording is stage0's because
stage1's parser refuses the syntax first (§A3's declared class, and those
wordings do not survive R6), and `stage1_divergence.txt` names the thirteen
where the two compilers do not agree at all. `npm test` runs the tool over both
compilers, the second with `--strict-refusals`, so a case that starts agreeing
fails until its line is deleted.

## Example case

```
tests/cases/
  cf_while_break.ts     # source
  cf_while_break.ll     # expected IR
  cf_while_break.out    # expected stdout when run through tests/driver.c
```

```typescript
// tests/cases/cf_while_break.ts
// `break` inside `while` must jump to the loop exit block, not fall through to
// the condition; the golden pins the block names so a regression reads as a diff.
export const test = (): number => {
  let i = 0;
  while (true) {
    i = i + 1;
    if (i === 5) {
      break;
    }
  }
  return i;
};
```
