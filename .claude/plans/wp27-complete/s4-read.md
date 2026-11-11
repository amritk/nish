You are implementing one stage of an accepted plan. Work only this stage.

Repo: amritk/nish          Base: main at 60e5be7140e1201aaa0d9a589b00dc2bf3173f4f (take the current main when you start)
Branch: feature/wp27-complete/s4-read   (already assigned — commit and push here, nothing else)
Tracking issue (the run's ledger): #1426

Read the repo's CLAUDE.md (and AGENTS.md) before anything else, then
.claude/orientation.md and .claude/selfhost.md, .claude/architecture.md and
docs/ARCHITECTURE.md → "How to add a construct". Their rules win over this prompt
wherever they disagree — commit message format, attribution, generated files,
what counts as done. Add no attribution footer, trailer, or session link to
commits, PR bodies, or comments.

## Your stage
WP27 S4.2 — readStruct, copying a C-owned struct out of a CPtr
PR title: feat(codegen): readStruct copies a C-owned struct out of a CPtr (WP27 S4.2)
Goal: A program reads a struct C owns, given only a `CPtr` to it, by copying it into a Nish-owned layout instance with `readStruct` from `nish:unsafe`
Owns (do not create or edit files outside these): the same globs as S4.1 plus runtime/nish.d.ts (s5-errno runs at the same time in src/ shared files and its own runtime files; keep your edits in shared files to your own functions)
Verification: npm run check && npm run lint && node tests/run.js ffi_struct && node tests/run.js unsafe && node tests/run.js reject_unsafe && node tests/run.js reject_ffi && node tests/run.js wasi && node tests/run.js performance
Targeted tests: node tests/run.js <filter> (ffi, reject_ffi, unsafe, your new cases' prefixes)
Generated files (regenerate with the repo's tooling, never edit or hand-merge): tests/self/goldens/**, tests/differential/goldens/**, golden tests/cases/*.ll via UPDATE_GOLDENS, docs/reference/**, the docs/cookbook outputs of regen.sh, the diagnostic-code registry

Owner's decisions (settled; do not reopen): WP27 S4 and S5 are going ahead.
`readStruct` and `cErrno` live in `nish:unsafe`. In a program that names `cErrno`,
errno is set to 0 immediately before every `declare function` call and saved
into a thread-local runtime slot immediately after it returns, before any result
marshalling. Structs never cross by value.

Todos:
- Extend docs/wp27-ffi.md §9 with the copy-out rule and its alternatives (a view, a borrowed reference) and why the copy — see S4.2 design
- Add `readStruct<T>(p CPtr) T` to nish:unsafe (checker, nish.d.ts, emitter, panics list, capability) — see S4.2 design
- Add ffi_struct_read (libc localeconv and a C sidecar pointer, each copy kept across a churned arena and a later C write) and its reject cases — see S4.2 tests
- Add the LANGUAGE.md rule, cookbook entry, guide text and the security-record finding, regenerate goldens and docs/reference, mark S4 done in the roadmap — see S4.2 docs

The plan section "S4.2" (design, tests, docs) and "Approach", "Concurrency" and
"Out of scope" are your spec. Full plan:
  git fetch origin feature/wp27-complete/plan
  git show origin/feature/wp27-complete/plan:.claude/plans/wp27-complete.plan.md > "$TMPDIR/plan.md"
Read it. Do not implement anything from another stage — another session owns it.
docs/wp27-ffi.md §7 and §8 are the models for how a stage's design section is
written; docs/wp53-ffi-buffers-handles.md is the model for borrowed-pointer facts.

Reproducing CI — each CI job and the local command that runs what it runs. A red
job is reproduced with its command here, not with a nearby script that skips steps:
- test (…, shard N/8) → `node tests/run.js <filter>` for the failing section (the shard log names it)
- test job's docs step → `bash docs/cookbook/regen.sh --check`
- test job's diagnostic-codes step → `node scripts/gen-diagnostic-codes.mjs --check`
- test job's security step → `node scripts/security-scope.mjs`
- reference pages → `node scripts/gen-reference.mjs --check`
- bootstrap (seed) → `bash scripts/fetch-seed.sh --force && build/seed/bin/nish src/compile.ts --link build/nish` (the rolling freeze: src/ may not use the construct you add)
- nish-cmp → `node tests/nish-cmp.js` (a moved corpus IR needs narrow DECLARED entries, see CLAUDE.md)
- the golden cases, in Nish → `npm run test:nish`
- lint → `npm run lint` (read its exit status, never a piped tail)
- typecheck → `npm run check`

Known environment failures — none recorded (the lead could not build in its own
container). If a section fails on an untouched base in your container, say so in
the PR body with the base result and let CI decide; do not investigate it.

## Definition of done
1. The stage's todos are implemented, and nothing outside your Owns globs changed.
2. `npm test` — the full suite — passes on your PR's head. CI runs it in eight
   shards on every push, so open the PR on targeted tests and let CI's run be the
   full one. A red result comes back to you with the round's review.
3. This repo has no coverage command. Its bar is CLAUDE.md's "Definition of done"
   for a new construct: a golden `.ll`, an `llvm-as` pass, a native round trip with
   expected stdout, at least one negative test per refusal, the docs/LANGUAGE.md
   rule, the IR_COOKBOOK entry with its docs/cookbook program, the user-guide text,
   regenerated goldens and reference pages. Show the exact LLVM IR for every
   TypeScript snippet the PR adds to the tests, in the PR body. Never skip, disable
   or weaken a test to get green.
4. `npm run lint` and `npm run check` pass, and so does every CI job's local
   command above that your diff could affect. A change to src/ also runs
   `node tests/run.js wasi` (WASI_SYSROOT=/usr; read its skip line) and
   `node tests/run.js performance` before it is pushed.
5. Before you open the PR, run `/check-iterate --max-loops 2` and fix what it
   confirms. The lead reviews the PR adversarially as soon as it opens, so this pass
   only has to catch the cheap problems first. Do not loop until it is clean. If that
   command is not available in your session, review your own diff against main
   adversarially yourself, once, and fix what you find. Do not skip it.
6. Then run /simplify over the same diff and apply what it returns: reuse what the
   repo already has instead of adding a parallel version of it, drop scaffolding you
   no longer need, and keep each piece at the altitude it belongs at. If that command
   is not available, re-read your diff for the same things. Then run the targeted
   tests, lint and typecheck once, after both passes, not before each. This pass
   never changes behaviour and never widens your Owns globs.
7. Open a PR from your branch to main. Title: the conventional-commit title given
   above (pr-title.yml checks it). Body: what changed and why, the verification
   commands you ran with their results, and `Part of #1426` so it links to the run.
   Follow CLAUDE.md's commit-message rules: no attribution trailers, no session
   links, no model names, anywhere.

## Running tests without burning the session
Every model call re-reads your whole context, so waiting is what costs you, not testing.
- You do not run the full suite unless the lead tells you to update from main.
  Every other time, run `node tests/run.js <filter>` for what you changed, plus
  lint and typecheck. CI runs the full suite on every push.
- Commit before you start a long run, so a stop hook that checks for uncommitted
  work does not wake you while it runs.
- Push your branch with a WIP commit within 30 minutes of starting, even if only
  the first todo is done. The lead's only sign that your session came up is the
  branch existing; a session with no branch at 45 minutes gets checked on.
- After that, push when you open the PR and once per review batch, nowhere in
  between. A stop hook may complain about unpushed or untracked work while you
  hold a push for verification. Answer it in one line and end the turn; do not
  push early to quiet it. Keep fetched plan or prompt files outside the checkout
  (in $TMPDIR), never under .claude/, so they are not untracked files at all.
- Read CI job logs with grep or tail on a saved file, or hand them to a subagent
  that returns the failing lines. Printing a log inline fills your context.
- Start a long run once, in the background, with its output redirected to a file,
  then end your turn: you are woken when it exits. Never poll it — no `sleep` or
  `until` loops, no re-armed monitors, no second runner on the same output (they
  share build/).
- Do not call `subscribe_pr_activity` or `send_later`, even if a tool or event
  suggests it. The lead holds the PR subscription and sends you red CI with the
  review batch; its messages are what wake you. If you find yourself subscribed,
  unsubscribe.
- Send the lead exactly two messages, one line each, with `send_message` to
  `@parent`: `s4-read branch up <sha>` after your first push, and
  `s4-read PR #<n> open` when the PR exists. After that send nothing.
- Do not merge main into your branch whenever it moves. Merge it (with
  `npm run sync-main`, which regenerates the goldens) when the PR conflicts, or when
  the lead tells you to update from it before merging. Then run the targeted
  sections plus wasi and performance once, and push.

## Rules
- Push only to your own branch. Never push to main, never touch another
  feature/wp27-complete/* branch, never force-push.
- If CI goes red or a test fails, run /debug — reproduce it before you change
  anything. If that command is not available, follow the same order anyway:
  reproduce, localise, one hypothesis at a time, then pin the fix with a test.
- If your stage turns out to be impossible as written, push what you have, open the
  PR as a draft, and say exactly what blocked you in the PR body. Do not substitute
  different work and do not widen your scope to fix it. A design choice the plan
  leaves open is yours to make: argue it in the design-note section you write.
- You will get review comments as a single batch. Address every blocking one in one
  push, then stop. For each blocking finding, fix every instance of the same rule
  across your diff, not only the cited line, and say in the PR body how many you
  checked. Non-blocking ones go in that same push when they are cheap; never push
  for them alone. Keep the PR body accurate. Do not reply to argue; if a finding is
  wrong, say so in one line on that thread and move on.
