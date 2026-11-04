---
name: std_cli_args timing flake
overview: Show which check fails when a Nish-runner case exits wrong, prove the "wide: a parse is under 10 µs" check is what fails under load, and replace that absolute wall-clock bound with a same-process ratio that still fails on a pathological parser. Refs #1195 (item 4).
stages:
  - id: cli-args-ratio
    title: "test(cli): bound the wide-tree parse by a same-process ratio, and show stdout when a runner case exits wrong"
    goal: tests/link/std_cli_args no longer depends on the CI machine's speed, still fails on a parser that walks the tree per token, and the Nish runner prints a case's stdout when its exit code is wrong
    verification: node tests/run.js std_cli_args && npm run test:nish && npm run check && npm run lint
    status: pending
    todos:
      - id: runner-stdout-on-exit-mismatch
        content: In tests/nish/run.ts, when a case's exit code is wrong, still print its stdout (the diff against expected.out, or the raw stdout) so CI names the failing check — see Stage 1, Runner
        status: pending
      - id: print-per-parse
        content: Make the wide-tree check print the measured figures when it fails — see Stage 1, Prove the cause
        status: pending
      - id: reproduce-under-load
        content: Reproduce the failure locally under CPU load with the old 10 µs check and record perParse — see Stage 1, Prove the cause
        status: pending
      - id: ratio-bound
        content: Replace `perParse < 10000.0` with a wide/narrow ratio measured in the same process — see Stage 1, The new bound
        status: pending
      - id: pathological-parser-fails
        content: Show the new bound failing on a locally-written per-token tree walk (not committed), and record the numbers for the PR body — see Stage 1, The new bound
        status: pending
      - id: goldens
        content: Run node tests/self/goldens.js --update and node tests/differential/goldens.js --update; commit whatever moves, read the diff — see Stage 1, Verification
        status: pending
---

# std_cli_args timing flake

Issue #1195 item 4. `tests/link/std_cli_args` sometimes fails in CI's "the golden
cases, in Nish (shard 1/3)" as `FAIL link/std_cli_args: exits with 0 — expected
0, got 1`, with nothing else in the log. It fails when a PR's added link case
moves it into shard 1/3 under four-job load, and it passes locally.

The suspected check is `tests/link/std_cli_args/main.ts:511-521`:

```ts
const start = monotonicNanos()
for (let i: i32 = 0; i < runs; i++) { ... wide.cli.parse(argv, 1) ... }
const nanos = toF64(monotonicNanos() - start)
const perParse = nanos / toF64(runs)
t.ok("wide: a parse is under 10 µs", perParse < 10000.0)
```

The case builds with `--profile debug` (it is not in `tests/speed-link.txt`).
Locally perParse is 1–2.5 µs, a 4–7x margin that a loaded CI runner can cross.

## Stage 1: cli-args-ratio

**Owns:** `tests/link/std_cli_args/**`, `tests/nish/run.ts`, `tests/self/goldens/checked/**` (generated), `tests/differential/goldens/**` (generated)

### Runner

`tests/nish/run.ts:696` checks the exit code first and returns on a mismatch,
skipping the stdout comparison. Keep the exit-code failure, but on a mismatch
also print the case's stdout — the diff against `expected.out` when one exists,
or the stdout itself — so a CI log names the failing check. Bound what it
prints (a long stdout should not flood the log; the failing lines are what
matters). Worth keeping on its own, independent of the flake.

### Prove the cause

1. Make the wide-tree check print its measured figures (perParse today; the
   ratio and both timings after the fix) at least when it fails.
2. Reproduce locally before changing the bound: run the case with the old
   10 µs check under CPU load comparable to CI's four jobs (for example
   competing busy loops on every core, or `taskset` onto one core shared with
   burners) until it fails, and record the printed perParse. Put the command and
   the number in the PR body. If it cannot be reproduced, say so in the PR body
   and what was tried — do not claim it was proven.

### The new bound

The check exists to catch a pathological slowdown in `nish/cli-args` (a walk
over the whole tree per token, quadratic parsing), not to measure speed. Do not
raise 10 µs, and do not delete or skip the check.

Replace it with a ratio measured in the same process: build a narrow tree with
the same depth and the same argv shape (one group, one command, the same eight
flags), time the same parse on both trees, and bound wide/narrow. Machine load
slows both sides alike, so the ratio is stable where the absolute figure is not.

- Interleave the two measurements (several alternating batches) and compare the
  minimum batch time of each side, so a burst of load during one side's batch
  does not decide the result.
- Measure the honest ratio on this machine, unloaded and under the load from
  "Prove the cause", and set the bound with clear margin above both.
- The wide tree has 500 commands against the narrow tree's 1, so a per-token
  tree walk multiplies the ratio by hundreds. Write such a parser locally (for
  example, make `parse` scan every command in the tree for each token), show
  the new check failing on it with the printed ratio, then revert it. It is
  not committed. Put the numbers in the PR body with one paragraph on why the
  ratio form still fails on a pathological parser.
- Keep the existing correctness checks on the wide tree (the leaf id, the
  three flag values, every parse finds it). Update `expected.out` for any
  renamed check.

### Verification

- `node tests/run.js std_cli_args` (or whatever filter selects this case in
  `tests/run.js`; find it), and the `std_cli_args_exit` sibling if it is touched.
- `npm run test:nish`, and CI's shard command
  `build/nish-runner --compiler build/nish --shard 1/3` several times, at
  least once under the same load used to reproduce.
- `npm run check`, `npm run lint` — read the exit status, not a piped tail.
- `node tests/self/goldens.js --update` and `node tests/differential/goldens.js
  --update`; commit whatever moves.
- No change under `src/` or `std/`, so `tests/run.js wasi` and `performance`
  are not required. If the fix needs a `std/` change, stop and say so in the PR
  instead.
- The full suite is CI's: every `test (…, shard N/4)` row and every Nish-runner
  shard green on the head, each shard's skip count read.
