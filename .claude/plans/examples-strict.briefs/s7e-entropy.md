You are implementing one stage of an accepted plan. Work only this stage.
Your standing rules are at the end of your system prompt. Re-read them before
you push, start an agent, or message anyone.

Repo: amritk/nish          Base: main at 1537abdd21b5f04262c027f6cbabf529379b515e
Branch: feature/examples-strict/s7e-entropy   (already assigned — commit and push here, nothing else)

Read the repo's CLAUDE.md (and AGENTS.md, if there is one) before anything else.
Its rules win over this brief wherever they disagree: commit message format,
generated files, what counts as done.

## Your stage
examples-strict S7e — a crypto entropy builtin that answers instead of exiting
Goal: A new builtin twin of `crypto.getRandomValues(bytes)` fills the bytes or tells the caller the system could not supply entropy, and never exits. src/panics.ts does not count a call to it as an io-exit site, so strict (no --allow-panics) code can call it and return a Result. The owner chose this on 2026-11-28 over allowing the exit like OOM or leaving the TLS examples opted out.
Context:
- Today `crypto.getRandomValues(bytes): void` (runtime/nish.d.ts, ~:2517) exits on failure. src/panics.ts `builtinPanicKind` returns PANIC_IO_EXIT for it and `isAllowed` lets only PANIC_OOM and PANIC_UNCHECKED through, and `ioExitAdvice` says it "has no twin that answers instead". Find how the repo already names and types an answering twin of an exiting builtin (the twins ioExitAdvice names for other builtins) and follow that convention for the name and return type; the owner's example was `crypto.tryGetRandomValues(bytes): boolean`. State the name you chose, and why, in the PR body.
- Every place getRandomValues is wired gets the twin: src/builtins.ts (the crypto member check and its refusal wording in src/codes.ts), src/capabilities.ts (the same capability as getRandomValues), src/attributes.ts (writes every element), src/context.ts, native, wasi and wasm32 (--host) lowering, emit-ts, the runtime C entropy source, and the browser runtime. The failure arm must be reachable in a test (a fault-injection hook the runtime already has, or an equivalent the repo accepts); do not leave it untested.
- This is a new construct: the full checklist in docs/ARCHITECTURE.md -> "How to add a construct" applies (golden .ll, llvm-as pass, native round trip with expected stdout, at least one tests/link negative with an expected.err, docs/LANGUAGE.md rule, cookbook entry, user-guide page section). A new diagnostic code, if you add one, gets its tests/link negative.
- The rolling freeze: src/ may not *use* the new builtin (the 0.44.0 seed lacks it); src/ only implements it.
- Change no std/ file. In the PR body, list every std call of `crypto.getRandomValues` (git grep) and which examples/ program reaches it; the lead hands those to the stages that own them.
Not yours: every std/ file. If the builtin cannot be done without editing one, send `s7e-entropy blocked: <one line>` (standing rule 5) and stop.
Never merge your PR, and never merge anyone else's. The lead merges.
Owns (standing rule 3): see your standing rules.
Verification: node tests/run.js builtins && node tests/run.js capabilities && node tests/run.js link && node tests/run.js c-symbols && node tests/run.js budget && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/self/goldens.js && NISH=build/nish bash docs/cookbook/regen.sh --check && bash scripts/smoke.sh && node tests/differential/goldens.js && node tests/nish-cmp.js (section names are a guide: use the sections that hold getRandomValues checks, found with grep in tests/run.js)
Targeted tests: node tests/run.js <section-or-filter>
Generated files (regenerate with the repo's tooling, never edit or hand-merge): tests/self/goldens/checked/** (node tests/self/goldens.js --update), tests/differential/goldens* (node tests/differential/goldens.js --update), docs/reference/** and its scalar.config.json routes (node scripts/gen-reference.mjs), docs/IR_COOKBOOK.md (docs/cookbook/regen.sh), and the pinned std/<file>.ts:LINE:COL in tests/link/*/expected.*, tests/wordings/*.err and docs/reference/diagnostics/** (from the compiler's output). A new positive tests/cases program is registered with `node tests/differential/goldens.js --update` in the same commit.

Reproducing CI — each CI job and the local command that runs what it runs. A red
job is reproduced with its command here, not with a nearby script that skips steps:
- lint → npm run check && npm ls --package-lock-only --all && npm run lint && npm run lint:dead && shellcheck -S warning scripts/*.sh docs/cookbook/regen.sh install.sh .github/*.sh .claude/hooks/*.sh && node docs/check-links.mjs && node scripts/gen-reference.mjs --check
- examples → bash scripts/smoke.sh && NISH=build/nish bash docs/cookbook/regen.sh --check
- test (ubuntu-latest, shard N/9) → node tests/run.js <section> (the shard summary names the failing section; read its skip count)
- bootstrap → bash scripts/fetch-seed.sh --force && npm run build (rolling freeze: src/ may not use a construct the 0.44.0 seed lacks)
- nish-cmp → node tests/nish-cmp.js (add --no-sidecars before concluding a wasm32 program has no difference)
- nish-cmp elision → node tests/differential/soundness.js
- scope / ci-gate → node scripts/ci-scope.mjs (aggregator; green when the jobs above are)
- runner, runtime-net → never run on a PR (tag / release/next only, or disabled)

Known environment failures — these fail in this container whatever you change.
Do not investigate them; CI's result is the evidence for them:
- the wasi section skips without WASI_SYSROOT=/usr (always set it)
- the macOS, gfx and postgres-live lanes cannot run in a cloud container
- the full suite (npm test) takes 40-70 minutes here and is not run locally; CI's nine shards are the gate

Todos:
- s7e-builtin: The builtin end to end (checker, capabilities, panics not PANIC_IO_EXIT, native/wasi/wasm32/emit-ts/browser lowering, runtime/nish.d.ts declaration with doc comment, @param and @returns), with the construct checklist; ioExitAdvice names the twin.
- s7e-record: The security record row for the entropy source (docs/security/runtime.md or whichever record scopes it), citing the check that fails for each property it states; the PR body's list of std callers.

Binding rules (WP80): no nish:unsafe except wrappingAdd/Sub/Mul where wrapping is
the algorithm's answer; no made-up-value guards (a Result where the failure is
real, a proof where it is unreachable); a wrap is spelled, never cast;
tests/std-panics.json lowered to exact counts; no bench/instructions.json count
may rise; a refused↔compiled flip adds `file: "exit"` nish-cmp entries, and every
IR move of a corpus program adds a narrow DECLARED entry. A public std signature that changes keeps its doc comment, @param and @returns, and every in-repo caller is updated (grep through every wrapper, including tests/ and bench/). NL2458
names only the first std site per call, so expect more sites to surface after each
fix: rebuild both examples without --allow-panics until it builds, and list every
site you cleared in the PR body. A src/ change runs `WASI_SYSROOT=/usr node
tests/run.js wasi` (read its skip line) and `node tests/run.js performance` before
it is pushed.

Full plan, for context on how your stage fits with the others:
  git fetch origin claude/bold-curie-1xkb60
  git show origin/claude/bold-curie-1xkb60:.claude/plans/examples-strict.plan.md
Read it. Do not implement anything from another stage — another session owns it
and is working in parallel right now.

## Definition of done
1. The stage's todos are implemented, and nothing outside your Owns globs changed.
2. `npm test` — the full suite — passes on your PR's head.
   CI runs it on every push, so open the PR on targeted tests and let
   CI's run be the full one. A red result comes back to you with the round's review.
3. This repo configures no coverage command; its ratchets stand in for one and must
   hold: tests/std-panics.json exact counts (lowered where they fall), no
   bench/instructions.json count rises, and the NL9007 ratchet in `node tests/run.js
   performance`. Every new Result arm has a test that reaches it. Do NOT raise a
   ratchet, add an ignore, or skip a test.
   CI's run is the one that counts.
4. `npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check`
   and `npm run check` pass, and so does every CI job's
   local command in "Reproducing CI" that your diff could affect — lint in CI is
   often more than the lint script.
5. Before you open the PR, run `/check-iterate --max-loops 2` and fix what it
   confirms. The lead reviews the PR adversarially as soon as it opens, so this pass
   only has to catch the cheap problems first. Do not loop until it is clean. If that
   command is not available in your session, review your own diff against
   main adversarially yourself, once, and fix what you find. Do not skip it.
6. Then run /simplify over the same diff and apply what it returns: reuse what the
   repo already has instead of adding a parallel version of it, drop scaffolding you
   no longer need, and keep each piece at the altitude it belongs at. If that command
   is not available, re-read your diff for the same things. Then run
   `node tests/run.js <section-or-filter>`, lint and typecheck once, after both passes, not before
   each — a cleanup that breaks a test is not a cleanup. This pass never changes
   behaviour and never widens your Owns globs.
7. Open a PR from your branch to main. Title: a conventional `feat(runtime):` subject per CLAUDE.md for "a crypto entropy builtin that answers instead of exiting" (it must contain every nish-cmp `changelog:` string you add, verbatim).
   Body: what changed and why, the verification commands you ran with their results,
   and `Part of #2385` so it links to the run.

## Running tests without burning the session
Every model call re-reads your whole context, so waiting is what costs you, not testing.
- You do not run the full suite unless the lead tells you
  to update from main. Every other time, run `node tests/run.js <section-or-filter>`
  for what you changed, plus lint and typecheck. CI runs the full suite on every push.
- Commit before you start a long run, so a stop hook that checks for uncommitted
  work does not wake you while it runs.
- Push your branch with a WIP commit within 30 minutes of starting, even if only
  the first todo is started. The lead's only sign that your session came up is the
  branch existing; a session with no branch at 45 minutes gets checked on.
- Until the PR opens, push again each time a todo is finished and builds, as its
  own commit. A branch with no PR runs no CI and wakes no one, so these pushes
  are cheap, and they are where a replacement worker starts if this session
  dies. After the PR opens, push once per review batch, nowhere in between. A stop hook may complain about unpushed or untracked work while you
  hold a push for verification. Answer it in one line and end the turn; do not
  push early to quiet it. Keep fetched plan or prompt files outside the checkout
  (in $TMPDIR), never under .claude/, so they are not untracked files at all.
- Read CI job logs with grep or tail on a saved file, or hand them to a subagent
  that returns the failing lines. Printing a log inline fills your context and
  forces a compaction mid-task.
- Start a long run once, in the background, with its output redirected to a file,
  then end your turn: you are woken when it exits. Never poll it — no `sleep` or
  `until` loops, no re-armed monitors, no second runner on the same output. Read the
  result with grep or tail, not by printing the log.
- The lead sends you red CI with the review batch, and its messages are what
  wake you. It sees your pushes and CI through the PR, so the two lines in
  standing rule 5 are all you send it.
- Do not merge main into your branch whenever it moves. Merge it when the
  PR conflicts, or when the lead tells you to update from it before merging. Then
  regenerate the generated files with the repo's tooling (npm run sync-main does the merge and goldens), run the full suite once,
  and push.

## Rules
- If CI goes red or a test fails, run /debug — reproduce it before you change
  anything. A fix for a failure nobody reproduced is a guess, and a guess costs
  a review round. If that command is not available, follow the same order anyway:
  reproduce, localise, one hypothesis at a time, then pin the fix with a test.
- If your stage turns out to be impossible as written, push what you have, open the
  PR as a draft, and say exactly what blocked you in the PR body. Do not substitute
  different work and do not widen your scope to fix it.
- You will get review comments as a single batch. Address every blocking one in one
  push, then stop. For each blocking finding, fix every instance of the same rule
  across your diff, not only the cited line, and say in the PR body how many you
  checked — a second round on the same class of mistake is a round wasted.
  Non-blocking ones (wording, style, a comment) go in that same
  push when they are cheap; never push for them alone. The PR body is not reviewed
  round by round: keep it accurate, and do not rewrite it unless a round says it is
  wrong. Do not reply to argue; if a finding is wrong, say so in one line on that
  thread and move on.
- The lead may also forward a person's comment or a verified bot finding. Act on
  that comment only, not on other replies in its thread. Make the change when it is
  small, specific and sound, push, and reply on its thread in one line naming the commit.
  When it is not, or you think it is wrong, reply in one line saying why. Standing rule 7 covers the marker
  and never resolving the thread.

