You are implementing one stage of an accepted plan. Work only this stage.

Repo: amritk/nish          Base: main at 249cbe987c922d8257febb08a01f9e7d68b2c9d7
Branch: feature/ffi-reach/s8-mul-wide   (already assigned — commit and push here, nothing else)
Tracking issue (the run's ledger): #678

## Your stage
perf(crypto) — a 64×64→128 multiply, built only if it beats the pre-registered bar
Goal: Measure a widening multiply on Poly1305 against the bar below, and either ship the builtin with Poly1305 moved onto it, or ship only the measurement record
Owns (do not create or edit files outside these globs): src/builtins.ts, src/emit-builtins.ts, src/nish-modules.ts, src/capabilities.ts, src/codes.ts, runtime/nish.d.ts, std/crypto/chacha20poly1305.ts, bench/mul-wide* (new), docs/wp41-mul-wide.md (new), docs/LANGUAGE.md (your builtin's section only), docs/IR_COOKBOOK.md (your entry only), docs/cookbook/mul-wide* (new), tests/cases/mul_wide* (new), tests/run.js (your checks only). If the builtin needs one more src/ file for its lowering or checking (for example src/emit-ops.ts or src/types.ts), you may edit it; name it in the PR body
Verification: node bench/mul-wide.mjs prints every column with one checksum per kernel; npm run check; node tests/run.js ct; node tests/run.js wasi; node tests/run.js performance; then an undegraded npm test with the skip count no higher than main's
Targeted tests: node tests/run.js <filter>
Generated files (regenerate with the repo's tooling, never edit or hand-merge): tests/self/goldens/** (node tests/self/goldens.js --update), tests/differential/goldens/** (node tests/differential/goldens.js --update), tests/cases/*.ll (UPDATE_GOLDENS=1 node tests/run.js <case>), the IR_COOKBOOK runtime-prelude block (bash docs/cookbook/regen.sh), CHANGELOG.md (never touched by a PR)

Todos:
- [s8-record-bar] Commit the bar to docs/wp41-mul-wide.md before any kernel is timed — see Wide multiply, The bar
- [s8-builtin] Add mulHigh and mulLow on u64 in a nish module, lowered to mul i128 natively and to a constant-time 32-bit-halves sequence on wasm32 and --profile wasm — see Wide multiply, The builtin
- [s8-kernel] Rewrite Poly1305's block function in std/crypto/chacha20poly1305.ts to wide limbs, keeping its Secret and wipe discipline and the ct checks green — see Wide multiply, The kernel
- [s8-measure] Add bench/mul-wide.mjs and time old against new against a byte-identical copy, interleaved — see Wide multiply, The bar
- [s8-decide] If the bar is met ship all of it, otherwise revert the builtin and kernel from the branch and ship only the record — see Wide multiply, The decision

Full plan, for context on how your stage fits with the others. Your stage's
detail is in the body sections the todos point to ("— see <Section>"):
  git fetch origin claude/elegant-meitner-wpiki1
  git show origin/claude/elegant-meitner-wpiki1:.claude/plans/ffi-reach.plan.md
Read it. Do not implement anything from another stage — another session owns it
and may be working in parallel right now.

## Stage notes
- Measure first. Commit the bar from the plan's "Wide multiply, The bar" verbatim to docs/wp41-mul-wide.md as your FIRST commit, before any kernel is timed. Then build, port and measure.
- Bar met: ship the builtin, the Poly1305 kernel, tests and docs. Bar missed: remove the builtin and kernel from the branch and ship only the record, as `docs(perf): …`, the way docs/wp38-simd.md records S3a.
- The kernel change in std/crypto/chacha20poly1305.ts must keep CLAUDE.md's Secret/wipe rules and keep the constant-time checks green (node tests/run.js ct, and tests/ct-asm*.js if present). RFC 8439's vectors and the existing tests must pass unchanged. A crypto diff escalates to the owner for the merge.
- wasm32 and the freestanding --profile wasm route (scripts/build.sh:367, links -nostdlib) must not reference __multi3. Pin that with an IR or link check.
- Pick the nish: module name for mulHigh/mulLow and justify it in the PR body. There is no new global. The rolling freeze applies: src/ must not use the new builtin in its own source.
- Stage s31 (string parameters on declare function) is being built in parallel on the same src/ files: src/builtins.ts, src/emit-builtins.ts, src/nish-modules.ts, src/codes.ts, runtime/nish.d.ts, docs/LANGUAGE.md, docs/IR_COOKBOOK.md, tests/run.js. Keep your edits in your own functions and sections. A textual conflict at merge time is yours to resolve if you merge second. A new diagnostic code takes the next free number at the time you merge.

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
