---
name: Get main's CI green — take the timing race out of tests/cases/async_cancel
overview: CI on main (7d921842) is red on one job, `nish-cmp elision (aarch64-linux)`, step "Every proof-backed elision changes nothing a program prints". soundness.js ran tests/cases/async_cancel twice in its default build and the two runs printed lines 3 and 4 in different orders — `nap:` before `quiet:` once — so it reported the case `nondeterministic`, which fails the run. Nothing about elision differed (differ=0). The case races two clocks — `quiet` finishes a 5 ms readableWithin plus a writableWithin while `nap` is cancelled by cancelAfter at 10 ms — and a loaded ASan aarch64 runner running four programs at once can take more than 5 ms to come back. The fix makes the order structural instead of timed, and leaves the runtime and compiler untouched.
stages:
  - id: async-cancel-order
    title: "test(runtime): print async_cancel's lines in an order no clock decides"
    goal: tests/cases/async_cancel prints its four expected lines in the same order on every run, however slow the machine, while still exercising cancel, cancelAfter, readableWithin and writableWithin exactly as before.
    verification: node tests/run.js async_cancel && node tests/run.js async && npm run check && npm run lint && node tests/self/goldens.js --check (or the repo's equivalent) && the compiled case run 200 times under `stress-ng --cpu $(nproc)` (or four parallel copies of a busy loop) prints tests/cases/async_cancel.out byte for byte every time
    status: pending
    todos:
      - id: reorder
        content: In tests/cases/async_cancel.ts, spawn `nap` only after `await quiet(fd)` returns, so `quiet:` is printed before `nap` exists; widen main's closing `sleep(30)` (the margin that lets `nap` print before main returns) to something like 200 ms, still far under the one-second sleeps; update the header comment to say why the order is structural — see Fix
        status: pending
      - id: goldens
        content: Regenerate the case's golden tests/cases/async_cancel.ll, keep async_cancel.out unless the line order intentionally changes, run `node tests/differential/goldens.js --update` and `node tests/self/goldens.js --update` (with `--seed build/seed/bin/nish` if there is no build/nish), and read each diff — see Fix
        status: pending
      - id: stress
        content: Prove the order holds under load — build the case and run it 200 times with every core busy, and run `node tests/differential/soundness.js --compiler <built compile> --corpus tests/cases` filtered to the case if the script supports a filter; put the counts in the PR body — see Fix
        status: pending
---

# Get main's CI green — async_cancel's timing race

## Evidence

- Run https://github.com/amritk/nish/actions/runs/43452682926, job `nish-cmp elision (aarch64-linux)`:
  `NONDETERMINISTIC  cases/async_cancel  default run twice: stdout line 3: default "nap: armed true, slept false, again false, cancelled true", --no-elision "quiet: ready false, open true, cancelled false"`
  and `soundness: agree=1527 elided=1528 differ=0 ... nondeterministic=1`.
- Every other job in that run is green; the previous main run (9fe73fe7) was green on the same job. The case last changed in #1460, so this is a latent flake that a slow runner exposed, not a regression in #1531.

## Fix

Owns: `tests/cases/async_cancel.ts`, `tests/cases/async_cancel.ll`, `tests/cases/async_cancel.out`, `tests/self/goldens/checked/**`, `tests/differential/**` golden files the update scripts rewrite.

`quiet`'s 5 ms bounded wait and `nap`'s 10 ms `cancelAfter` are measured from nearly the same moment, so their prints race with a 5 ms margin. Spawning `nap` after `await quiet(fd)` makes the order a matter of program structure. The remaining clock is main's closing sleep, which has to outlast `nap`'s 10 ms cancellation; give it a wide margin (about 200 ms) rather than 30.

Do not touch `tests/differential/soundness.js` (do not add a known-nondeterministic list or a retry), the runtime, or `src/`. Skipping, quarantining or loosening the check is out of scope. If the reorder cannot be done without changing what the case tests, stop and report rather than widening scope.

`tests/nish-cmp.js` already declares this program (`file: "exit"`, the 0.37.0 seed cannot compile it), so no new DECLARED entry is expected; run nish-cmp on it to confirm.

Commit subject (the changelog line): `test(runtime): print async_cancel's lines in an order no clock decides`.
