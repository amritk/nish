You are implementing one stage of an accepted plan. Work only this stage.

Repo: amritk/nish          Base: main at 7a5876459fd8e5b45e72d2a4cfc1ee0a2849e0e8 (or later; fetch main)
Branch: feature/multicore-http/tcp-reuseport   (already assigned: commit and push here, nothing else)
Tracking issue: #719 (the run's ledger). Spec: issue #478.

## Your stage
feat(net) — tcpListenFlags, SO_REUSEPORT on a TCP listener
Goal: Ship tcpListenFlags(host, port, backlog, flags) in nish:net, flag 1 setting SO_REUSEPORT before bind, any other bit -22, refused on wasm32 with NL2404, tcpListen unchanged
Owns (do not create or edit files outside these globs, except regenerated files): `src/nish-modules.ts`, `src/runtime.ts`, `runtime/runtime-net.c`, `runtime/nish.h`, `runtime/nish.d.ts`, `runtime/nish.mjs`, `runtime/shim.mjs`, `tests/runtime-test.c`, `tests/runtime-budgets.js`, `tests/cases/net_tcp_reuseport*`, `tests/cases/reject_net_reuseport*`, `tests/link/net_tcp_reuseport*/**`, `tests/nish-cmp.js`, `tests/differential/goldens/**`, `tests/self/goldens/**`, `docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`, `docs/cookbook/**`, `docs/AI.md`, `docs/wp7-runtime.md`, `docs/wp35-capabilities.md`, `docs/security/runtime.md`, `docs/guide/using-nish/networking.md`, `docs/guide/using-nish/standard-library.md`, `docs/guide/language/modules.md`, `scalar.config.json`
Verification: npm run check, npm run lint, node tests/run.js net_, node tests/run.js wasi (its skip line read), node tests/run.js performance, then an undegraded npm test
Targeted tests: node tests/run.js <section or case-name substring>
PR title / squash subject: feat(net): tcpListenFlags, SO_REUSEPORT on a TCP listener

Todos:
- [s1-builtin] Add tcpListenFlags to the nish:net export list and netSignature in src/nish-modules.ts, its declare in src/runtime.ts, and the twins in runtime/nish.h, runtime/nish.d.ts, runtime/nish.mjs and runtime/shim.mjs — see tcpListenFlags, Surface
- [s1-runtime] Implement nish_tcp_listen_flags in runtime/runtime-net.c through nish_net_bound, and raise NET_TEXT_BUDGET in tests/runtime-budgets.js with the measurement beside it and its row in docs/wp7-runtime.md — see tcpListenFlags, Runtime
- [s1-tests] Add tests/cases/net_tcp_reuseport (two listeners on one port, flags 2, 4 and -1 giving -22), reject_net_reuseport_wasm, a tests/runtime-test.c case, and a tests/link/net_tcp_reuseport_spread case that shows loopback connections accepted on both listeners — see tcpListenFlags, Tests
- [s1-docs] Write the LANGUAGE.md rule with the per-platform table, the IR_COOKBOOK entry and cookbook program, the regenerated runtime prelude, docs/AI.md, a new docs/guide/using-nish/networking.md page with its scalar.config.json route, the wp35 net row and RT-17 in docs/security/runtime.md — see tcpListenFlags, Docs
- [s1-goldens] Register the new cases (tests/differential/goldens.js --update, tests/nish-cmp.js DECLARED entries) and regenerate tests/self/goldens with node tests/self/goldens.js --update — see Generated files

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
