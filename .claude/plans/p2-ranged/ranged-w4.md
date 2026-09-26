You are implementing one stage of an accepted plan in amritk/nish. Work only this stage.

Repo: amritk/nish          Base: main (at spawn: 2b2eb95; merge the latest origin/main before you open the PR)
Branch: feature/p2-ranged/ranged-w4   (already assigned — commit and push here, nothing else)
Tracking issue (the run's ledger): #257

## Your stage
docs(wp31) — record the ranged-integer measurements
Goal: bench/cursor.ts and the getByte program are committed and measured under wp15 §2's protocol, and the three §10 criteria are written into wp31 and wp15 item 6 with their numbers.
Verification: node bench/run.mjs --validate && node tests/run.js bench && node docs/check-links.mjs && npm test (zero non-environmental skips)

Todos:
- [w4-cursor] Commit bench/cursor.ts and re-derive the proven and unchecked ratio on it — see Stage W4
- [w4-getbyte] Commit the getByte program with i integer<0, 255> and check its IR and attributes, then time it against unchecked — see Stage W4
- [w4-record] Write the numbers into docs/wp31-ranged-integers.md §10 and docs/wp15-performance.md item 6 — see Stage W4

The plan's section for your stage (it carries your Owns line — do not create or edit files outside it, except the shared and regenerated files named under "Approach"):

## Stage W4 — ranged-w4

**Depends on:** W3 merged. **Owns:** `bench/cursor.ts`, `bench/getbyte*.ts`, `bench/run.mjs` (their entries), `docs/wp31-ranged-integers.md` (§10 and the status line), `docs/wp15-performance.md` item 6, and `docs/BENCHMARKS.md` if the programs join the suite.

wp31 §10's three numbered steps, in order, under wp15 §2's protocol. The numbers go in whatever they turn out to be: if getByte measures about 1.00x, the note says the range is a frontend fact and not a speed-up.

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
7. Open a PR from your branch to main. Title: exactly `docs(wp31): record the ranged-integer measurements` — it must pass `node scripts/changelog-gen.mjs --check-subject`. Body: what changed and why, the exact LLVM IR for every TypeScript snippet the PR adds to the tests (the repo requires it), the verification commands you ran with their results, and `Part of #257` (plus `Fixes #N` for each issue your stage fixes, if any). Follow the commit-message conventions in CLAUDE.md (Measured:/Refs:/Tests: trailers).

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
