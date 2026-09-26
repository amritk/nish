You are implementing one stage of an accepted plan in amritk/nish. Work only this stage.

Repo: amritk/nish          Base: main (at spawn: 2b2eb95; merge the latest origin/main before you open the PR)
Branch: feature/p2-ranged/ranged-w1   (already assigned — commit and push here, nothing else)
Tracking issue (the run's ledger): #257

## Your stage
feat(checker) — ranged integer types (WP31)
Goal: integer<Lo, Hi> is a type — parsed, interned as K_RANGED, mangled rng.p0.p255, i32 everywhere — every entry into it is checked at run time, every §4 refusal has a code, and -g writes a typedef, exactly as wp31 §10's W1 row lists.
Verification: npm run check && node tests/parser-oracle.js --verbose && node tests/run.js rng_ && node tests/run.js dbg_rng && node tests/differential/unmodified.js --compiler build/nish-test && node tests/run.js self && npm test (zero non-environmental skips)

Todos:
- [w1-parse] Add N_TYPE_LITERAL as the next node kind (63 today, N_COUNT moving to 64) to src/nodes.ts and parsePrimaryType, with the parser oracle mapping — see Stage W1
- [w1-type] Add K_RANGED to the type table with rangedOf, typeName, mangle and resolveReference, turning NL2333 into the type — see Stage W1
- [w1-refuse] Refuse every §4 row, a literal type anywhere else, and a ranged type in a declare function, each with a new NL2xxx code and a wordings program — see Stage W1
- [w1-entry] Check every §6 entry with one unsigned compare and a cold panic through one shared panic-tail helper, and a compile error for an out-of-range literal — see Stage W1
- [w1-widen] Implement §7's widening (const keeps the range, let widens, operators read i32, type arguments keep it) — see Stage W1
- [w1-dbg] Emit the DW_TAG_typedef for -g and add the runtime/nish.d.ts line — see Stage W1
- [w1-docs] Add the LANGUAGE.md Types rule, AI.md, the cookbook entry, and the Node divergence in its three places — see Stage W1

The plan's section for your stage (it carries your Owns line — do not create or edit files outside it, except the shared and regenerated files named under "Approach"):

## Stage W1 — ranged-w1

**Owns:** `N_TYPE_LITERAL` in `src/nodes.ts`/`src/parser.ts`, `tests/parser-oracle.js`, `K_RANGED` in `src/types.ts`, `resolveReference` in `src/annotations.ts`, the entry points in `src/statements.ts`/`src/expressions.ts`/`src/members.ts` and argument checking, the declare-function refusal in `src/declarations.ts`, the panic-tail helper across `src/emit-builtins.ts`/`src/emit-result.ts`/`src/attributes.ts`, the entry emission, `src/debug.ts` (typedef), `runtime/nish.d.ts` (the one line), `tests/cases/rng_*`, `tests/cases/reject_rng_*`, `tests/cases/dbg_rng*`, `tests/wordings/**` (its programs), `tests/differential/unmodified.js` (`KNOWN`), `tests/differential/known-failures.txt`, `docs/RUN_UNDER_NODE.md` (one bullet), and the Types section of LANGUAGE.md, AI.md and the cookbook.

wp31 §10's W1 row, verbatim, is the todo list; §4, §5, §6, §7 and §9 (the DWARF and declare-function parts) are the spec. Points to hold:

- **Node kinds:** `N_TYPE_LITERAL` is the next kind (63; `N_COUNT` 64). wp31 §4 says 61, written before two kinds were appended. A literal type is parsed wherever a type is parsed, and refused by the checker everywhere except as a bound of `integer`.
- **Mangling:** `rng.p0.p255` / `rng.m128.p127`. `Box<integer<0, 255>>` is `%struct.Box$rng.p0.p255`.
- **Entries:** every §6 entry is checked in W1, since nothing is elided yet. A range that is all of `i32` gets no check. The check survives `--unchecked-indexing`. The panic tail is factored once, and `runtime.c`'s budget does not move.
- **Divergence:** the Node divergence is recorded in its three places, as §6 lists them.
- **Tests:** the tests column of the W1 row. Existing goldens move only where the shared panic helper changes their IR, and the PR says which and why.

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
7. Open a PR from your branch to main. Title: exactly `feat(checker): ranged integer types (WP31)` — it must pass `node scripts/changelog-gen.mjs --check-subject`. Body: what changed and why, the exact LLVM IR for every TypeScript snippet the PR adds to the tests (the repo requires it), the verification commands you ran with their results, and `Part of #257` (plus `Fixes #N` for each issue your stage fixes, if any). Follow the commit-message conventions in CLAUDE.md (Measured:/Refs:/Tests: trailers).

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
