You are implementing one stage of an accepted plan. Work only this stage.

Repo: amritk/nish          Base: main at 249cbe987c922d8257febb08a01f9e7d68b2c9d7
Branch: feature/ffi-reach/d4-design   (already assigned — commit and push here, nothing else)
Tracking issue (the run's ledger): #678

## Your stage
docs(interop) — design for u8[] buffers and owned foreign handles across declare function
Goal: A new design doc that the owner reviews before stages 5 and 6 are built, covering u8[] as pointer plus length, an owned handle closed by using, and the stage 9 question of whether std/'s own foreign calls can keep attributes, summaries and oracle coverage
Owns (do not create or edit files outside these globs): docs/wp40-ffi-buffers-handles.md (a new file) and nothing else
Verification: npm run lint; node docs/check-links.mjs; every design question in the stage section answered with a file:line anchor at a stated commit, and every planned negative case named
Targeted tests: node tests/run.js <filter>
Generated files (regenerate with the repo's tooling, never edit or hand-merge): tests/self/goldens/** (node tests/self/goldens.js --update), tests/differential/goldens/** (node tests/differential/goldens.js --update), tests/cases/*.ll (UPDATE_GOLDENS=1 node tests/run.js <case>), the IR_COOKBOOK runtime-prelude block (bash docs/cookbook/regen.sh), CHANGELOG.md (never touched by a PR)

Todos:
- [d4-buffers] Design u8[] read-only and writable buffer parameters as pointer plus length under S3's borrow rule — see Design doc, Buffers
- [d4-handles] Design the owned foreign handle — a class field holding a CPtr, released by using, with use-after-close and double-close ruled out or a defined panic — see Design doc, Handles
- [d4-interactions] For each of the two, say how it interacts with escape analysis, arena scopes, --deny ffi, the three --emit generators, wasm32, --profile wasm and the differential oracle — see Design doc, Interactions
- [d4-siblings] List every way in that CLAUDE.md names (constructor by new, every using declarator, this leaving a constructor) and each other entry found, each with its planned negative case name — see Design doc, Siblings
- [d4-std-foreign] Answer stage 9's precondition with evidence from src/attributes.ts, src/capabilities.ts, src/visibility.ts and tests/differential — see Design doc, Stage 9 precondition
- [d4-refusals] Write the non-goals as refusals with their reject case names — see Out of scope

Full plan, for context on how your stage fits with the others. Your stage's
detail is in the body sections the todos point to ("— see <Section>"):
  git fetch origin claude/elegant-meitner-wpiki1
  git show origin/claude/elegant-meitner-wpiki1:.claude/plans/ffi-reach.plan.md
Read it. Do not implement anything from another stage — another session owns it
and may be working in parallel right now.

## Stage notes
- This PR is a design document only, no code. After it merges the run stops for the owner's review before anything in it is built, so write it for that reviewer: decisions first, alternatives weighed, every claim about today's compiler anchored as `file:line` at a stated commit (the base above), every planned test named.
- Model it on docs/wp27-ffi.md §7 and §8 (read both in full) and docs/wp38-simd.md's decision-record style. WP27 already names S4 (struct layout) and S5 (errno), so name your stages so they collide with neither.
- The plan's "Design doc" section lists every question the doc must answer, including the Stage 9 precondition. Answer that one with evidence, not hope: today a foreign callee gets EFFECT_WRITE, willReturn=false and sharedWrite (src/attributes.ts around :3386), callers keep only nounwind, a program declaring C is never a closed build (src/visibility.ts:99), FFI cases leave the oracle via tests/differential/known-failures.txt, and the capability becomes ffi rather than fs.
- Stages s31–s33 (WP27 S3) are being built in parallel from docs/wp27-ffi.md §8. Design on top of §8's rules as written; do not edit wp27-ffi.md.
- Verification for a docs-only PR: npm run lint and node docs/check-links.mjs. Skip the full npm test unless your doc adds a compiled example (docs/AI.md-style examples are compiled by npm test; a design doc's are not). Say in the PR body which you ran.
- Commit and PR title: `docs(interop): …`.

## First, in this order
1. Read CLAUDE.md, then .claude/orientation.md, then every other .claude/*.md file
   CLAUDE.md tells you to read before the kind of change you are making
   (selfhost.md before src/, typescript.md and comments.md before TypeScript,
   testing.md before tests, licensing.md before copying code). Their rules are
   authoritative.
2. bash scripts/fetch-seed.sh --force   (a stale seed has made clean main fail before).
3. Confirm the toolchain: the SessionStart hook installs LLVM 18; `npm test`'s summary
   must show no DEGRADED banner. Record main's skip count from your first full run
   or from a `node tests/run.js` run on an unmodified checkout, so you can show your
   head's skip count is no higher.

## Definition of done
1. The stage's todos are implemented, and nothing outside your Owns globs changed
   (generated files excepted).
2. `npm run check`, `npm run lint` (read the exit status, never a piped tail),
   `node tests/run.js wasi` (read its skip line; WASI_SYSROOT=/usr if wasi-libc is
   installed) and `node tests/run.js performance` pass. No new NL9007 in src/.
3. An undegraded full `npm test` passes on the head you open the PR from, with a
   skip count no higher than main's. This repo has no coverage tool: its bar is the
   definition of done in CLAUDE.md — a new construct ships a golden .ll, an llvm-as
   pass, a native round trip with expected stdout, at least one negative test, its
   docs/LANGUAGE.md rule, IR_COOKBOOK entry with docs/cookbook/ program, and its
   docs/guide page. Never skip, disable or weaken a test, never raise a ceiling in
   tests/runtime-budgets.js, never edit CI workflows.
4. Before you open the PR, run /check-iterate and fix what it confirms. If that
   command is not available in your session, review your own diff against main
   adversarially yourself and fix what you find — do not skip it. Probe the
   "siblings of the rule" CLAUDE.md names (a constructor reached by `new`, every
   declarator of a `using`, `this` leaving a constructor) for any rule you add.
5. Then run /simplify over the same diff and apply what it returns. If that command
   is not available, re-read your diff for reuse, dead scaffolding and altitude.
   Then run the full suite once, after both passes, not before each.
6. Open a PR from your branch to main, using .github/PULL_REQUEST_TEMPLATE.md's
   sections. Title: a conventional-commit subject that reads as a changelog entry
   (`feat(interop): …`, `feat(std): …`, `docs(interop): …`, `perf(crypto): …`); the
   squash merge lands it, and pr-title.yml checks it. Body: what changed and why,
   the exact LLVM IR for every TypeScript snippet the PR adds to the tests, the
   verification commands you ran with their results (pass/fail/skip counts), and
   `Part of #678`. Commit messages follow CLAUDE.md "Commit messages are the
   changelog" (Measured:/Refs:/Tests: trailers; Measured: carries real figures and
   the noise band). NEVER put session links, model names or platform attributions
   in commits, code or PR text; after the PR opens, read its body back and delete
   any footer a tool appended, or pr-body.yml fails.
7. Do NOT merge your PR, even when CI is green. The run's lead reviews and merges
   it. (This overrides CLAUDE.md's "merge it yourself" for this run only.)

## Running tests without burning the session
Every model call re-reads your whole context, so waiting is what costs you, not testing.
- The full suite (40–70 min) runs twice: before you open the PR, and when the lead
  says you are next to merge. During review rounds run `node tests/run.js <filter>`
  for what the round changed, plus check and lint; CI runs the full suite on every push.
- Commit before you start a long run, so a stop hook that checks for uncommitted
  work does not wake you while it runs.
- Start a long run once, in the background, with its output redirected to a file,
  then end your turn: you are woken when it exits. Never poll it — no `sleep` or
  `until` loops, no re-armed monitors, never a second run while one is going (they
  share build/). Read the result with grep or tail, not by printing the log.
- Do not schedule check-ins for yourself and do not subscribe to PR activity: the
  lead holds the PR subscription and its messages wake you.
- Do not merge main into your branch whenever it moves. Merge it when the PR
  conflicts, or when the lead tells you you are next to merge — then regenerate the
  generated files with the repo's tooling (never resolve them by hand), run the full
  suite once, and push.

## Rules
- Push only to your own branch. Never push to main, never touch another
  feature/ffi-reach/* branch, never force-push.
- If CI goes red or a test fails, run /debug — reproduce it before you change
  anything. If that command is not available, follow the same order anyway:
  reproduce, localise, one hypothesis at a time, then pin the fix with a test.
- If your stage turns out to be impossible as written, or the design it builds on
  disagrees with the code, push what you have, open the PR as a draft, and say
  exactly what blocked you in the PR body. Do not substitute different work and do
  not widen your scope to fix it.
- You will get review comments as a single batch. Address every blocking one in one
  push, then stop. Non-blocking ones go in that same push when they are cheap; never
  push for them alone. Do not reply to argue; if a finding is wrong, say so in one
  line on that thread and move on.
