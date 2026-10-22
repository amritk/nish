You are implementing one stage of an accepted plan. Work only this stage. Nobody
is watching this run live: do not ask questions — decide, and say what you decided
and why in the PR body.

Repo: amritk/nish          Base: main at 0209668f0daa0115217ef833c5b5a6e8be255c1f
Branch: feature/open-issues/hpack-caller-storage   (already assigned — commit and push here, nothing else)
Run ledger: issue #808

## Your stage
fix(net): decode HPACK into caller-owned storage and bound the HTTP/2 header bomb (#473)
Goal: HPACK decoding writes into storage the connection owns and bounds, so a small header block cannot expand ~1000:1 into fresh allocations (H2-1), and a refused stream is covered adversarially
Owns (do not create or edit files outside these globs, generated files aside; a
"shared" path you may edit only in your own rule, row or section): `std/net/hpack.ts`, `std/net/http2.ts`, `tests/link/net_http2`, `tests/link/net_http2_f64`, `tests/link/net_http2_hpack*`, shared: `docs/security/http2.md`, `tests/run.js`
Verification: node tests/run.js link (the sections running tests/link/net_http2*) green with the bomb and refused-stream cases; npm run check, npm run lint green
Targeted tests: node tests/run.js <section> (.claude/testing.md lists the sections)
Generated files (regenerate with the repo's tooling, never edit or hand-merge):
tests/self/goldens/**, tests/differential/**, tests/cases/*.ll,
docs/IR_COOKBOOK.md's runtime prelude (docs/cookbook/regen.sh)

Todos:
- Make std/net/hpack.ts decodeFields write into caller-owned, bounded storage and adapt http2.ts endBlock to it
- Add the "HTTP/2 Bomb" worst case and a refused-stream adversarial case from #473's comments
- Close H2-1 in docs/security/http2.md with the measured bound

Stage note from the plan: Shares `std/net/http2.ts` with h2-reset-budget, so it starts once that merges.

Full plan, for context on how your stage fits with the others:
  git fetch origin feature/open-issues/plan
  git show origin/feature/open-issues/plan:.claude/plans/open-issues.plan.md
Read it. Do not implement anything from another stage — another session owns it
and is working in parallel right now.

Before writing code: read CLAUDE.md, .claude/orientation.md, and the .claude/ guides
its table points you to for what you touch (selfhost.md for src/, testing.md before
adding tests, docs/security/README.md for std/crypto, std/net or docs/security/).
Run `bash scripts/fetch-seed.sh --force` before building. Read the issue (#473) and
all its comments — a later comment often narrows or changes the ask.

## Definition of done
1. The stage's todos are implemented, and nothing outside your Owns globs changed.
2. `npm test` — the full suite, undegraded (read the skip count, not just the exit
   code) — passes on the head you open the PR from.
3. Coverage: this repo has no coverage command, so the undegraded `npm test` stands
   in. Every rule or behaviour you add has a positive and a negative test. Do NOT
   skip, disable or quarantine a test, and do not loosen a check to get green.
4. `npm run lint` and `npm run check` pass. Read their exit status, never a piped tail.
5. A change a Nish user sees updates its docs/guide/ page in the same PR (CLAUDE.md).
6. Before you open the PR, run /check-iterate and fix what it confirms. If that
   command is not available in your session, review your own diff against main
   adversarially yourself and fix what you find — do not skip it. Probe every way
   into a rule you add, not only the one the issue names.
7. Then run /simplify over the same diff and apply what it returns. If that command
   is not available, re-read your diff for the same things. Then run the full suite
   once, after both passes, not before each. This pass never changes behaviour and
   never widens your Owns globs.
8. Regenerate the generated goldens with the repo's tooling and read their diff:
   `node tests/self/goldens.js --update` (add `--seed build/seed/bin/nish` if
   build/nish is not built), and `node tests/differential/goldens.js --update` for
   any new positive tests/cases/*.ts.
9. Open a PR from your branch to main. Title: `fix(net): decode HPACK into caller-owned storage and bound the HTTP/2 header bomb (#473)` (a conventional commit — it
   is the changelog entry; follow CLAUDE.md's "Commit messages are the changelog").
   Body: what changed and why, the exact LLVM IR for each TypeScript snippet you add
   to the tests (CLAUDE.md), the verification commands you ran with their results,
   `Fixes #473`, and `Part of #808`. After it opens, read the body back and delete
   any session-link footer appended to it (pr-body.yml fails otherwise).

## Running tests without burning the session
Every model call re-reads your whole context, so waiting is what costs you, not testing.
- The full suite runs twice: before you open the PR, and when the lead says you are
  next to merge. During review rounds run `node tests/run.js <section>` for what the
  round changed, plus lint and typecheck; CI runs the full suite on every push.
- Commit before you start a long run, so a stop hook that checks for uncommitted
  work does not wake you while it runs.
- Start a long run once, in the background, with its output redirected to a file,
  then end your turn: you are woken when it exits. Never poll it — no `sleep` or
  `until` loops, no re-armed monitors, no second runner on the same output (they
  share build/). Read the result with grep or tail, not by printing the log.
- Do not schedule check-ins for yourself. The lead's messages and PR events wake you.
- Do not merge main into your branch whenever it moves. Merge it when the PR
  conflicts, or when the lead tells you you are next to merge — then run
  `npm run sync-main` (it merges and regenerates the goldens), commit, run the full
  suite once, and push.

## Rules
- Push only to your own branch. Never push to main, never touch another
  feature/open-issues/* branch, never force-push.
- Do NOT merge your own PR, even though CLAUDE.md says a PR's author merges it: in
  this run the lead merges, after its review rounds. Do not subscribe to or babysit
  the PR beyond fixing what the lead sends you and red CI on your own head.
- If CI goes red or a test fails, run /debug — reproduce it before you change
  anything. If that command is not available, follow the same order anyway:
  reproduce, localise, one hypothesis at a time, then pin the fix with a test.
- If your stage turns out to be impossible as written, push what you have, open the
  PR as a draft, and say exactly what blocked you in the PR body. Do not substitute
  different work and do not widen your scope to fix it.
- You will get review comments as a single batch. Address every blocking one in one
  push, then stop. Non-blocking ones go in that same push when they are cheap; never
  push for them alone. Keep the PR body accurate, and do not rewrite it unless a
  round says it is wrong. Do not reply to argue; if a finding is wrong, say so in one
  line on that thread and move on.
