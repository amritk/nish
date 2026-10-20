You are implementing one stage of an accepted plan. Work only this stage.

Repo: amritk/nish          Base: main at c8a00d6160781c616a877a9215958caaeb43c9fd
Branch: feature/unclaimed-issues/ctor-readonly   (already assigned — commit and push here, nothing else)
Run ledger: issue #763

## Your stage
fix(codegen): keep field-initialiser stores in an empty explicit constructor (#740)
Goal: A class whose explicit constructor body is empty, or writes no field itself, still runs its field initialisers, natively at -O2 as under Node
Owns (do not create or edit files outside these globs, generated files aside): `src/attributes.ts`, new `tests/cases/ctor_empty_init_*`, `tests/run.js` (append only)
Verification: node tests/run.js codegen (or the section holding the new cases) green, the new round trip printing the initialised values at -O2; npm run check, npm run lint, node tests/run.js wasi and node tests/run.js performance green; goldens regenerated and read
Targeted tests: node tests/run.js <section> (see .claude/testing.md for the sections)
Generated files (regenerate with the repo's tooling, never edit or hand-merge): tests/self/goldens/**, tests/differential/**, tests/cases/*.ll, docs/IR_COOKBOOK.md's runtime prelude (docs/cookbook/regen.sh)

Todos:
- Reproduce #740 natively at -O2 and pin which attribute inference in src/attributes.ts marks `this` readonly when the field-initialiser stores are emitted outside the written body
- Count the field-initialiser stores (and a discriminated-union variant's tag store) as writes to `this` when inferring the constructor's attributes
- Add tests/cases/ctor_empty_init_* cases with goldens and a native round trip at -O2 — an empty constructor, one that writes only a parameter-property, one that calls super — plus a negative check that a truly read-only method keeps `readonly`

Full plan, for context on how your stage fits with the others:
  git fetch origin feature/unclaimed-issues/plan
  git show origin/feature/unclaimed-issues/plan:.claude/plans/unclaimed-issues.plan.md
Read it. Do not implement anything from another stage — another session owns it
and is working in parallel right now.

Before writing code: read CLAUDE.md, .claude/orientation.md and .claude/selfhost.md,
and the other .claude/ files their rules point you to for what you touch (testing.md
before adding tests). Run `bash scripts/fetch-seed.sh --force` before building. Read
the issue (#740) and its comments in full.

## Definition of done
1. The stage's todos are implemented, and nothing outside your Owns globs changed
   (generated files aside; `tests/run.js` only by appending your own checks).
2. `npm test` — the full suite, undegraded (read the skip count, not just the exit
   code) — passes on the head you open the PR from. Also `node tests/run.js wasi` and
   `node tests/run.js performance` for any src/ change (CLAUDE.md says why).
3. Coverage: this repo has no coverage command, so the undegraded `npm test` stands
   in. Every rule you add has a positive and a negative test case. Do NOT skip,
   disable or quarantine a test.
4. `npm run lint` and `npm run check` pass. Read their exit status, never a piped tail.
5. Before you open the PR, run /check-iterate and fix what it confirms. If that
   command is not available in your session, review your own diff against main
   adversarially yourself and fix what you find — do not skip it. CLAUDE.md's rule
   "A checker rule covers every way in" applies: probe every way into your rule.
6. Then run /simplify over the same diff and apply what it returns. If that command
   is not available, re-read your diff for the same things. Then run the full suite
   once, after both passes, not before each. This pass never changes behaviour and
   never widens your Owns globs.
7. Open a PR from your branch to main. Title: `fix(codegen): keep field-initialiser stores in an empty explicit constructor (#740)` (a conventional commit — it
   is the changelog entry; follow CLAUDE.md's "Commit messages are the changelog").
   Body: what changed and why, the exact LLVM IR for each TypeScript snippet you add
   to the tests (CLAUDE.md), the verification commands you ran with their results,
   `Fixes #740`, and `Part of #763` so it links to the run. After it opens, read
   the body back and delete any session-link footer appended to it (pr-body.yml
   fails otherwise).
8. Regenerate the generated goldens with the repo's tooling and read their diff:
   `node tests/self/goldens.js --update` (add `--seed build/seed/bin/nish` if
   build/nish is not built), and `node tests/differential/goldens.js --update` for
   any new positive tests/cases/*.ts.

## Running tests without burning the session
Every model call re-reads your whole context, so waiting is what costs you, not testing.
- The full suite runs twice: before you open the PR, and when the lead says you are
  next to merge. During review rounds run `node tests/run.js <section>` for what the
  round changed, plus lint and typecheck; CI runs the full suite on every push.
- Commit before you start a long run, so a stop hook that checks for uncommitted
  work does not wake you while it runs.
- Start a long run once, in the background, with its output redirected to a file,
  then end your turn: you are woken when it exits. Never poll it — no `sleep` or
  `until` loops, no re-armed monitors, no second runner on the same output. Read the
  result with grep or tail, not by printing the log.
- Do not schedule check-ins for yourself. The lead's messages and PR events wake you.
- Do not merge main into your branch whenever it moves. Merge it when the PR
  conflicts, or when the lead tells you you are next to merge — then regenerate the
  generated files with the repo's tooling, run the full suite once, and push.

## Rules
- Push only to your own branch. Never push to main, never touch another
  feature/unclaimed-issues/* branch, never force-push.
- Do NOT merge your own PR, even though CLAUDE.md says a PR's author merges it: in
  this run the lead merges, after its review rounds. Do not subscribe to or babysit
  the PR beyond fixing what the lead sends you and red CI on your head.
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
