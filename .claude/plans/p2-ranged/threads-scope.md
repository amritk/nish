You are implementing one stage of an accepted plan in amritk/nish. Work only this stage.

Repo: amritk/nish          Base: main (at spawn: 2b2eb95; merge the latest origin/main before you open the PR)
Branch: feature/p2-ranged/threads-scope   (already assigned — commit and push here, nothing else)
Tracking issue (the run's ledger): #257

## Your stage
feat(checker) — threads P2, using s = scope() and s.spawn(fn, arg)
Goal: using s = scope(); s.spawn(entry, arg) spawns an OS thread per call and joins every one of them at every exit of the block, natively, and runs the same program under Node, per wp29 §4.2 and wp20 T1/T2.
Verification: npm run check && node tests/parser-oracle.js --verbose && node tests/run.js thread_ && node tests/run.js par_ && node tests/run.js self && npm test (zero non-environmental skips)

Todos:
- [p2-decide] Record the P2 decisions (using only for scope, no thread count, what a spawn may take and hand back, Node's flag) in wp29 §4.2's status note and §11 — see Stage P2
- [p2-parse] Lex and parse a using declaration as a kind of the existing variable declaration, with the parser oracle mapping it — see Stage P2
- [p2-check] Check scope and spawn in src/parallel.ts — using required, entry a named top-level function, argument shareable or lent, with new NL23xx codes — see Stage P2
- [p2-emit] Emit spawn and the join at every exit of the block, nested inside the arena bracket, with the runtime in runtime/runtime-parallel.c — see Stage P2
- [p2-node] Add scope and spawn to std/threads.ts so the same file runs under Node, and a tests/run.js check comparing it with native — see Stage P2
- [p2-docs] Add the LANGUAGE.md rules, AI.md, cookbook entry, RUN_UNDER_NODE.md line and a measured heterogeneous example — see Stage P2

The plan's section for your stage (it carries your Owns line — do not create or edit files outside it, except the shared and regenerated files named under "Approach"):

## Stage P2 — threads-scope

**Depends on:** B1 merged (both own `std/threads.ts` and `src/parallel.ts`). **Owns:** `src/parallel.ts`, `src/emit-parallel.ts`, `runtime/runtime-parallel.c` (and `runtime/nish.h` for any new symbol), the `using` token and declaration parse in `src/lexer.ts`/`src/tokens.ts`/`src/parser.ts`/`src/validator.ts`, the block-exit hook in `src/emit-control.ts`, `std/threads.ts`, `runtime/nish.d.ts` (the scope declaration), `tests/parser-oracle.js` (its `using` mapping), `tests/cases/thread_*` and `tests/cases/reject_thread_*`, `examples/` (one new program), `docs/wp29-thread-surface.md`, and the threads sections of LANGUAGE.md, AI.md and RUN_UNDER_NODE.md.

These are the decisions to record first, in wp29's status note and §11. They are the defaults unless the worker finds evidence against them, which it states:

- **`using` is accepted only for a `scope()`** (wp29 §11's narrow answer; widening later is not a break). Anything else under `using` is refused, as is `const s = scope()`: a scope must be introduced by `using`.
- **`scope()` takes no thread count.** Each `spawn` is one OS thread (wp29 §9 declines knobs before measurements).
- **`spawn(entry, arg)`**: `entry` is a named top-level function `(a: A) => void`. `A` is shareable per wp20 T2. wp29 §7 lets a worker *write through a pointer the parent lent it*, which T2's list does not allow. The stage must settle how a worker hands a result back, soundly: two spawns of one scope, or a spawn and the parent, never both reach one mutable value while the scope is open. If a lending rule can't be proved locally, only T2-shareable arguments are admitted, and results come back through a `parallelMapInto`-style disjoint destination, or not at all. Either way it is written down.
- **A worker may not allocate anything the parent reads** (wp29 §7). Its allocations live in its own thread-local arena.
- **The join is emitted at every exit of the block** (fall-through, `return`, `break`, `continue`), nested inside the WP6 arena bracket: the parent marks, the children run, the children join, the parent releases. A spawn inside a P1 region, or a spawn inside a spawn, follows whatever `nish_par_depth` decides, and the PR says what.
- **Under Node**, `using` needs `--js-explicit-resource-management` on Node 22 (it is native from Node 24). `std/threads.ts`'s `scope()` returns an object with `[Symbol.dispose]`, and `spawn` runs its task. The same program must print the same output whenever its tasks do not print, and `RUN_UNDER_NODE.md` says so.
- **Codes:** each refusal is a new NL23xx code, with its `reject_thread_*` case and a `tests/wordings/` program. That covers: no `using`, an entry that is not a top-level function, an argument that is not shareable (naming the field that disqualifies it, per wp20's table), and a `using` of anything else. `reject_thread_unjoined` is not needed; the construct replaces it.
- **Tests:** `thread_scope_basic` (two heterogeneous spawns, results read after the block), `thread_scope_exit_paths` (join on `return`/`break`), `thread_scope_nested_arena`, and the reject cases. Each has a golden `.ll`, an `llvm-as` pass and a native round trip. Add one example with a measured before/after on four cores, recorded in the PR's `Measured:` trailer.

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
7. Open a PR from your branch to main. Title: exactly `feat(checker): threads P2, using s = scope() and s.spawn(fn, arg)` — it must pass `node scripts/changelog-gen.mjs --check-subject`. Body: what changed and why, the exact LLVM IR for every TypeScript snippet the PR adds to the tests (the repo requires it), the verification commands you ran with their results, and `Part of #257` (plus `Fixes #N` for each issue your stage fixes, if any). Follow the commit-message conventions in CLAUDE.md (Measured:/Refs:/Tests: trailers).

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
