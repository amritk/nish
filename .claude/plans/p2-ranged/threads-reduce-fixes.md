You are implementing one stage of an accepted plan in amritk/nish. Work only this stage.

Repo: amritk/nish          Base: main (at spawn: 2b2eb95; merge the latest origin/main before you open the PR)
Branch: feature/p2-ranged/threads-reduce-fixes   (already assigned — commit and push here, nothing else)
Tracking issue (the run's ledger): #257

## Your stage
fix(interop) — parallelReduce under Node, and NL2348 at the call for a non-scalar reduce
Goal: A parallelReduce program prints the same natively and under Node's documented prelude path, and a reduce over string or class elements is refused with one NL2348 at the user's call naming the type (issues 224 and 225).
Verification: npm run check && node tests/run.js par_ && node tests/run.js threads && npm test (zero non-environmental skips)

Todos:
- [b1-node] Remove the i64-with-number mixing from std/threads.ts reduceBlockCount and reduceBlockStart without changing the blocking — see Stage B1
- [b1-resolve] Make nish/threads resolve under the documented Node path and add a tests/run.js check that runs a parallelReduce and a parallelMapInto program under Node against native output — see Stage B1
- [b1-nl2348] Refuse a non-scalar reduce element type at the call in src/parallel.ts with NL2348, pinned by reject_par_reduce_result_type (string and class) — see Stage B1

The plan's section for your stage (it carries your Owns line — do not create or edit files outside it, except the shared and regenerated files named under "Approach"):

## Stage B1 — threads-reduce-fixes (#224, #225)

**Owns:** `std/threads.ts`, `src/parallel.ts`, `src/emit-parallel.ts`, `tests/cases/*par_reduce*`, `tests/cases/reject_par_*`, `runtime/nish.mjs` and the Node resolution of `nish/threads` if needed, and its own `tests/run.js` check.

- `reduceBlockCount`/`reduceBlockStart` compute in i64 with a number literal, which throws under Node's prelude. They must compute the same blocks without that mixing. The blocking is part of the determinism contract (wp29 §11), so the block boundaries must not change: pin them with a case whose `n` is large enough to overflow i32 in `n * k`.
- #224 notes that `nish/threads` does not resolve under Node (the package self-reference is `@amritk/nish`). Make the documented `docs/RUN_UNDER_NODE.md` path work for a `nish/threads` import. Add a `tests/run.js` check that runs a reduce and a map program under Node and compares them with native output. The suite has none today.
- #225: a reduce over `string[]` or a class array must hit NL2348 at the user's call, before the std body is instantiated. Extend `reject_par_result_type` or add `reject_par_reduce_result_type`, with one `.err` each for `string` and a class.

The plan's Approach (rules every stage shares):

## Approach

- **Bugs first, then features.** Wave 1 is B1, B2, B4 and W1 (the longest chain). P2 starts once B1 merges, and B3 once B2 merges. W2 → W3 → W4 are sequential.
- **Every stage is one squash-merged PR** with a conventional title (the stage title), and meets the repo's definition of done. That means: goldens with an `llvm-as` pass, native round trips, a negative test per rule, and the LANGUAGE.md rule and cookbook entry for a construct.
- **Node kinds and codes are append-only and shared.** W1 owns the next node kind (`N_TYPE_LITERAL`, 63 on `main` today; wp31 §4's 61 predates `N_ARROW`). P2 adds **no node kind**: `using` is a declaration kind on the existing variable-declaration node. A new diagnostic code takes the next free number in `src/codes.ts` at merge time. When two stages collide, the later one renumbers after merging `main`, and its title, tests and docs follow.
- **Shared files are edited by section**, not owned: `docs/LANGUAGE.md`, `docs/AI.md`, the cookbook, `tests/run.js` (each stage adds its own named check), and `src/codes.ts`. Regenerated stores belong to no stage: `tests/self/goldens/**`, `tests/perf-baseline.json`, `bench/instructions.json`, `tests/differential/goldens/unfrozen.txt` and `tests/nish-cmp.js` DECLARED. Two concurrent stages both touch `src/statements.ts` and `src/expressions.ts` (B2, B3, W1), in different functions. The later merger merges `main` and resolves; it never rebases or force-pushes.
- **The rolling freeze.** `src/` may not *use* `using` or `integer<…>` in its own source. The seed cannot parse either.

## Verification

Every PR meets these, in addition to its stage's verification line:

- `npm run check`;
- an undegraded `npm test` (read the skip count, not just the exit code);
- `npm run lint` clean (every rule is an error since #255);
- `node docs/check-links.mjs` when Markdown changes;
- the title passing `node scripts/changelog-gen.mjs --check-subject`;
- `scripts/bootstrap.sh --verify` reaching the fixed point for any `src/` change.

The repo has no line-coverage tool; the golden harness and the definition of done in `CLAUDE.md` are the gate.

Full plan, for context on how your stage fits with the others:
  git fetch origin claude/threads-p2-ranged-integers-c1kein
  git show origin/claude/threads-p2-ranged-integers-c1kein:.claude/plans/p2-ranged.plan.md
Read it. Do not implement anything from another stage — other sessions own those and are working in parallel right now.

## Before you write code
Read CLAUDE.md, then every file in .claude/ (orientation.md and selfhost.md first). They are authoritative. The compiler moved from self/ to src/ in #256, so an issue that cites self/foo_bar.ts means src/foo-bar.ts. The rolling freeze applies: src/ may not use a construct the last release cannot compile.

## Definition of done
1. The stage's todos are implemented, and nothing outside your Owns changed (shared/regenerated files excepted, as the Approach says).
2. `npm run check` passes, and `npm test` passes UNDEGRADED — read the summary's skip count and make sure there is no DEGRADED banner; state the passed/failed/skipped numbers in the PR body. `npm run lint` is clean. `node docs/check-links.mjs` passes if you touched Markdown. `scripts/bootstrap.sh --verify` reaches the fixed point if you touched src/.
3. The repo's definition of done for a construct or a fix: golden .ll with an llvm-as pass, a native round trip with expected stdout, at least one negative test per rule, the docs/LANGUAGE.md rule (and cookbook entry for a construct). Every new diagnostic code in src/codes.ts takes the next free number in its band — check origin/main right before opening the PR, since sibling stages allocate codes too.
4. Never weaken a gate: no skipped/only tests, no loosened lint rule, no raised baseline without a written reason, no @ts-expect-error to pass types, no CI workflow edits.
5. Before you open the PR, run /check-iterate and fix what it confirms. If that command is not available in your session, review your own diff against main adversarially yourself and fix what you find — do not skip it.
6. Then run /simplify over the same diff and apply what it returns (reuse what the repo already has, drop scaffolding, keep each piece at its altitude). If it is not available, re-read your diff for the same things. Re-run the verification afterwards.
7. Open a PR from your branch to main. Title: exactly `fix(interop): parallelReduce under Node, and NL2348 at the call for a non-scalar reduce` — it must pass `node scripts/changelog-gen.mjs --check-subject`. Body: what changed and why, the exact LLVM IR for every TypeScript snippet the PR adds to the tests (the repo requires it), the verification commands you ran with their results, and `Part of #257` (plus `Fixes #N` for each issue your stage fixes, if any). Follow the commit-message conventions in CLAUDE.md (Measured:/Refs:/Tests: trailers).

## After the PR is open
- Subscribe to your PR's activity (subscribe_pr_activity) and schedule yourself a check-in every 30–45 minutes with send_later, so you wake on CI failures and on review comments.
- DO NOT MERGE YOUR PR, even though CLAUDE.md says the author merges — in this run the lead session merges every PR after its own review rounds. Do not approve it either. Never touch the Release PR #249.
- Review findings arrive as ONE review per round, posted on your PR by the lead. Address every finding in one push, then stop and wait for the next round. Do not argue; if a finding is wrong, say so in one line on that thread and move on. Resolve the threads you fixed.
- If main moves and your PR conflicts, merge origin/main into your branch (never rebase, never force-push) and re-run the verification.
- Stop your check-ins once the PR is merged or closed.

## Rules
- Push only to your own branch. Never push to main, never touch another feature/p2-ranged/* branch, never force-push.
- If CI goes red or a test fails, run /debug — reproduce it before you change anything. If that command is not available, follow the same order anyway: reproduce, localise, one hypothesis at a time, then pin the fix with a test. "Flake" is not a root cause.
- If your stage turns out to be impossible as written, push what you have, open the PR as a draft, and say exactly what blocked you in the PR body. Do not substitute different work and do not widen your scope to fix it.
- Never include session links, model names or platform attributions in commits, code or PR text.
