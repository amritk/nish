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
    (or `tests/driver.c`, which prints `test()`) and `runtime/runtime.c` and
    run. A source with `export const main` (or the legacy `export function
    main`) is linked without the driver.
  - `<name>.args` — extra CLI flags, whitespace separated.
  - `<name>.env` — the environment the run is given, one `NAME=value` per line,
    layered over the inherited one (blank lines and `#` comments ignored;
    `NAME=` sets an empty value, which is *set*). A case that calls `getenv`
    has no other way to pin its answer, because the language has no `setenv`.
    `tests/differential/lib.js` reads the same file, so the native binary and
    the Node rewrite are handed the same environment.
  - `<name>.stdout` — for dump flags (`--emit-ast`, `--emit-checked`): the
    compiler's stdout is the golden and no IR is written.
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
6. A diagnostic code, if the construct can be refused: run
   `node scripts/gen-diagnostic-codes.mjs` so `src/codes.ts` and `self/codes.ts`
   pick the new message up. The generator appends and never renumbers, and
   `npm test` fails while either file is stale. A message built entirely out of
   interpolations gets `NL0000`; giving it a code means giving it words of its
   own, not editing the table by hand.

A golden is only worth what a human can read in it: keep each case small and
about one thing, and hand-check the IR before committing it rather than
accepting whatever `test:update` wrote. A golden that changes for an unrelated
construct is a regression until proven otherwise.

Structural guards (`runtime.c` size budget, the runtime symbol table agreeing
across `runtime.ts`, `runtime.c` and `nish.h`, `opt -O2` vectorising
`cf_sum_loop`) pin properties that have been broken before. When one fails, the
change is what is wrong, not the test. Do not raise a budget or delete a guard
to get green.

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
```

`tests/self/goldens/` is the other family of checked-in golden here: the
`--emit-checked` dump of the whole corpus, and the stdout of the three driver
programs, as **stage1** prints them (WP19 gate G2.4). They exist because the
four oracles that presently prove those outputs compare stage1 with stage0 and
will prove nothing once `src/` is deleted. `npm run test:update` rewrites them
along with the `.ll` goldens, and `node tests/self/goldens.js --update` alone;
read `.claude/selfhost.md` before regenerating one, because regenerating from
the wrong compiler is how a golden records a bug as the specification.

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
