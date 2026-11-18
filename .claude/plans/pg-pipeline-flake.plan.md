---
name: Fix the std_postgres_async_pipeline section 13 flake
overview: CI's shard 3 intermittently fails link/std_postgres_async_pipeline on one line, section 13's loop-turn count ("over 8 loop turns" where expected.out says "over at most 5"). Three failures on 2026-11-18 alone (runs 44291274162, 44319393416 on main, 44359206618), all the same line, all "8", on PRs that do not touch the pool. Find the root cause by reproducing it, fix that cause, and keep the check able to catch the regression it was written for.
stages:
  - id: fix
    title: "test(net): make the pipelined pool's seats-freed-together check deterministic"
    goal: Section 13 of tests/link/std_postgres_async_pipeline passes every time under the load that made it fail, and still fails against a pool that wakes one queued seat per loop turn.
    verification: node tests/run.js std_postgres_async_pipeline && node tests/run.js std_postgres_async && npm run check && npm run lint
    todos:
      - id: reproduce
        content: Reproduce the "over 8 loop turns" output locally (CPU contention, parallel copies, taskset, or whatever does it) and record the command and its failure rate — see Fix
        status: pending
      - id: root-cause
        content: Localise why the eight queued seats are taken over 8 turns instead of at most 5 — the test's premise (the held answers arrive or free across turns) or the pool (std/net/postgres-async.ts wakes one waiter where several seats are free) — with evidence, one hypothesis at a time — see Fix
        status: pending
      - id: fix-cause
        content: Fix the cause it found — in the pool if the pool is wrong, in the test or its stand-in server if the premise is — without retries, skips, or a bound so loose that the one-a-turn pool passes — see Fix
        status: pending
      - id: still-discriminates
        content: Show the fixed check still fails against a pool that wakes one queued seat a turn (a temporary local mutation, its output quoted in the PR, not committed) — see Fix
        status: pending
      - id: repeat
        content: Rerun the reproduction at least 200 times after the fix with zero failures, and state the before/after rates in the PR — see Fix
        status: pending
---

# Fix the std_postgres_async_pipeline section 13 flake

## Fix

Owns: `tests/link/std_postgres_async_pipeline/**`,
`tests/link/std_postgres_async/server.ts`, `std/net/postgres-async.ts`,
`docs/security/postgres.md`, `docs/security/README.md`, `tests/nish-cmp.js`,
`tests/run.js`.

Generated (regenerate, never hand-edit): `tests/self/goldens/checked/**`,
`docs/reference/**`.

### What is known

- Every failure is the same single line of section 13
  (`tests/link/std_postgres_async_pipeline/main.ts`, "Seats freed together,
  taken together"):

  ```
  expected: eight seats freed together: 8 seated, over at most 5 loop turns
  actual:   eight seats freed together: 8 seated, over 8 loop turns
  ```

- Runs: 44291274162 (PR #1746 at 48db2540), 44319393416 (`main` at
  1673f40e), 44359206618 (PR #1753 at 596f07c1). All `test (ubuntu-latest,
  shard 3/8)`; none of the three commits changes the pool. The check passed
  on other heads of the same PRs.
- The section was added in accee663 (#1688). Its comment says seated
  together the eight span four turns, five is allowed for slack, and one a
  turn they span nine. The failures show eight, which is neither.
- `tick` counts turns with `await sleep(0)`. The stand-in server
  (`tests/link/std_postgres_async/server.ts`) runs on the same loop, reads
  with a non-blocking `netRead` before it awaits `readable`, and flushes each
  answer on its own.
- #1739 re-dealt the link programs across shards, so the program may now
  share shard 3 with heavier neighbours (#1750). Contention is the first
  thing to try in the reproduction.

### Rules for the fix

- Reproduce first (`/debug`). A change made before the 8-turn output has
  been seen locally is a guess.
- The check exists to catch a pool that wakes one queued seat a turn. A fix
  that widens the bound, moves the line out of `expected.out`, retries the
  program, or runs it serially *only* to hide the count has not fixed it.
  Running it apart from other programs is acceptable only if the root cause
  is shown to be contention and the check still discriminates under it.
- If the pool is at fault, `std/net/postgres-async.ts` changes: then the
  goldens, nish-cmp `DECLARED` entries, `docs/reference/`, and the
  `docs/security/postgres.md` record (and its README row if counts change)
  move in the same PR, per CLAUDE.md.
- A change to `tests/link/std_postgres_async/server.ts` also runs
  `node tests/run.js std_postgres_async` (the other program that uses it).
- `Refs #1750` in the PR body. Not `Fixes`: #1750 tracks other work too.
