You are implementing one stage of an accepted plan. Work only this stage.

Repo: amritk/nish          Base: main at 7a5876459fd8e5b45e72d2a4cfc1ee0a2849e0e8 (or later; fetch main)
Branch: feature/multicore-http/bench-cores   (already assigned: commit and push here, nothing else)
Tracking issue: #719 (the run's ledger). Spec: issue #478.

## Your stage
test(bench) — a --cores mode for bench/http.mjs and N-core twins
Goal: bench/http.mjs --cores 1,2,4 pins each server to cores 0..N-1 and wrk to the rest, passes BENCH_CORES=N to every server, and every twin that can use N cores is configured to use exactly N
Owns (do not create or edit files outside these globs, except regenerated files): `bench/http.mjs`, `bench/http-twins/**`
Verification: node bench/http.mjs --help prints --cores; bash bench/http-twins/run.sh --cores 1,2 --rounds 1 --duration 1 completes and prints a table per core count; npm run lint passes
Targeted tests: node tests/run.js <section or case-name substring>
PR title / squash subject: test(bench): a --cores mode for bench/http.mjs and N-core twins

Todos:
- [s3-harness] Add --cores to bench/http.mjs — the pinning layout, BENCH_CORES in each server's environment, one table per core count with the header naming the cores — see Bench harness
- [s3-twins] Read BENCH_CORES in each twin under bench/http-twins (GOMAXPROCS for both Go twins, worker_processes for nginx, N reusePort processes for Bun, workers(N) for actix, worker threads for hyper) and mark node-http and uws single-core — see Bench harness, Twins
- [s3-run] Pass --cores through bench/http-twins/run.sh and its README — see Bench harness

Full plan, for context on how your stage fits with the others:
  git fetch origin feature/multicore-http/plan
  git show origin/feature/multicore-http/plan:.claude/plans/multicore-http.plan.md
Read it, especially your stage's body section, which carries the detail your todos point at. Do not implement anything from another stage: another session owns it, and may be working in parallel right now. Read CLAUDE.md and .claude/orientation.md first, then the .claude/ files your work touches (selfhost.md before touching src/; testing.md before adding tests). Run `bash scripts/fetch-seed.sh --force` before building.

## Definition of done
1. Your stage's todos are implemented, and nothing outside your Owns globs changed, apart from generated files the repo's tooling regenerates.
2. `npm test`, the full suite, passes **undegraded** (read the skip count, not only the exit code) on the head you open the PR from.
3. The repo configures no coverage command. The bar is CLAUDE.md's definition of done: golden `.ll`, `llvm-as` pass, native round trip, at least one negative test, LANGUAGE.md rule, cookbook entry and guide page, for every construct you add. Never skip, disable or loosen a test or a budget to get green. A budget raise carries its measurement beside the number.
4. `npm run lint` and `npm run check` pass. If you touched src/ or std/, also run `node tests/run.js wasi` (read its skip line) and `node tests/run.js performance`. Read every check's exit status, never a piped tail.
5. Before you open the PR, run /check-iterate and fix what it confirms. If that command is not available in your session, review your own diff against main adversarially yourself and fix what you find; do not skip this.
6. Then run /simplify over the same diff and apply what it returns. If it is not available, re-read your diff for reuse, leftover scaffolding and altitude. Then run the full suite once, after both passes.
7. Open a PR from your branch to main. The title is the conventional subject given below. The body says what changed and why, the verification commands with their results (the skip count included), and the exact LLVM IR for every TypeScript snippet the PR adds to the tests (CLAUDE.md). End it with `Part of #719` and the line `Refs #478` (this stage does not close it). After opening it, read the body back and delete any session-link footer appended to it (pr-body.yml fails on it). Make the squash commit message the changelog entry CLAUDE.md describes (type(scope): subject, prose body, Measured:/Refs:/Tests: trailers where they apply).

## Running tests without burning the session
- The full suite runs twice: before you open the PR, and when the lead tells you you are next to merge. During review rounds, run `node tests/run.js <section>` for what the round changed, plus lint and typecheck. CI runs the full suite on every push.
- Commit before you start a long run, so the stop hook does not wake you about uncommitted work.
- Start a long run once, in the background, with its output redirected to a file, then end your turn: you are woken when it exits. Never poll it: no `sleep` or `until` loops, no re-armed monitors, and no second run on the same build/.
- Do not schedule check-ins for yourself. The lead's messages and PR events wake you.
- Do not merge main into your branch whenever it moves. Merge it when the PR conflicts, or when the lead says you are next to merge. Then regenerate the generated files with the repo's tooling (never by hand), run the full suite once, and push.

## Rules
- **You do not merge your PR.** CLAUDE.md says a PR's author merges it, but in this run the lead session merges every PR, in dependency order. Do not call merge, and do not enable auto-merge.
- Push only to your own branch. Never push to main, never touch another feature/multicore-http/* branch, and never force-push.
- If CI goes red or a test fails, run /debug and reproduce the failure before changing anything. If that command is unavailable, follow the same order: reproduce, localise, one hypothesis at a time, then pin the fix with a test.
- If your stage turns out to be impossible as written, push what you have, open the PR as a draft, and say exactly what blocked you in the PR body. Do not substitute different work, and do not widen your scope.
- Review comments arrive as a single batch. Address every blocking one in one push, then stop. Put the non-blocking ones in that same push when they are cheap; never push for them alone. Do not reply to argue. If a finding is wrong, say so in one line on that thread and move on.
- Generated files: `tests/self/goldens/**` (node tests/self/goldens.js --update), `tests/differential/goldens/**` (node tests/differential/goldens.js --update), `tests/cases/*.ll` (npm run test:update), `tests/link/**/*.ll` (--update-link-goldens), the cookbook runtime prelude (bash docs/cookbook/regen.sh), CHANGELOG.md. These are regenerated, never edited or hand-merged.
