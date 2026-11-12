You are implementing one stage of an accepted plan. Work only this stage.

Repo: amritk/nish          Base: main at ba4e8aef
Branch: feature/wp28-spikes-c0/record   (already assigned — commit and push here, nothing else)

Read the repo's CLAUDE.md and AGENTS.md before anything else, then the .claude/
guides CLAUDE.md's table names for what you touch. Their rules win over this
prompt wherever they disagree — commit message format, generated files, what
counts as done. Add no attribution footer, trailer, model name or session link to
commits, PR bodies, or comments.

## Your stage
docs: WP28's spikes and C0 recorded in the note and the roadmap
Stage id: record
Goal: The design note states what S2 to S6 measured and what each decides, the roadmap pages and index show S2, S3 to S6 and C0 done, and every place that says WP28 is unbuilt or waiting on acceptance says what is true now
Owns (do not create or edit files outside these globs): docs/wp28-compatibility-mode.md, docs/wp33-round-trip.md, docs/roadmap/wp28-compatibility-mode.md, docs/roadmap/wp33-round-trip.md, docs/roadmap/index.md, docs/README.md, docs/MASTER_PLAN.md, bench/README.md
Verification: node docs/check-links.mjs && npm run lint
Targeted tests: node tests/run.js <filter>

Todos:
- [record-note] In docs/wp28-compatibility-mode.md, replace the status header, mark S2 to S6 done in §7.1 with one result line each, add §7.5 to §7.9 giving each spike's figures, noise band and verdict from its bench README (linked, not copied in full), and correct §6.2's "strict rejects `async`" for WP24/WP49 — see Record, The note
- [record-open] In §10, strike what the spikes and C0 settled and leave each remaining question with the measurement that now bears on it; do not decide for the owner whether S2 retires C3 — state the figure and the two readings — see Record, The open questions
- [record-roadmap] Tick S2, S3 to S6 and C0 in docs/roadmap/wp28-compatibility-mode.md, set State to In progress and Done to 5 of 13, move Next to C1, move WP28 out of "Waiting on a decision" in docs/roadmap/index.md and fix its table row, and update docs/roadmap/wp33-round-trip.md's Next (R6 stays unticked) — see Record, The roadmap
- [record-mirrors] Update every mirror in the same PR — docs/wp33-round-trip.md §9, docs/README.md, docs/MASTER_PLAN.md — and add the four bench directories to bench/README.md with the command that runs each — see Record, The mirrors

Generated files (regenerate with the repo's tooling, never edit or hand-merge): tests/self/goldens/checked/**, tests/differential/** goldens, docs/reference/** (+ its scalar.config.json routes), tests/differential/emit-ts-known.txt (CI's Node only), docs/cookbook/** outputs of regen.sh

Reproducing CI — each CI job and the local command that runs what it runs. A red
job is reproduced with its command here, not with a nearby script that skips steps:
- lint → npm run lint && npm run lint:dead && npm run check && node scripts/gen-reference.mjs --check && node docs/check-links.mjs  (CI also shellchecks scripts)
- test (ubuntu-latest, shard N/8) → node tests/run.js <filter> for what you touched (the shards together are `npm test`)
- nish-cmp → bash scripts/fetch-seed.sh --force && node tests/nish-cmp.js
- bootstrap → npm run bootstrap
- goldens → node tests/self/goldens.js / node tests/differential/goldens.js
- the golden cases, in Nish → npm run test:nish
- conventional title → the PR title is a conventional commit subject (your stage title already is)
- interop, postgres-live → CI only

Known environment failures — these fail in this container whatever you change.
Do not investigate them; CI's result is the evidence for them:
no WASI sysroot unless WASI_SYSROOT=/usr; docker daemon not running (interop runner,
Autobahn, Chrome jobs are CI-only); no live Postgres; aarch64 NEON not reproducible;
h2load not preinstalled.

Full plan, for context on how your stage fits with the others, and for your
stage's own body section (named after each todo's "see …"), which is part of
your instructions:
  git fetch origin feature/wp28-spikes-c0/plan
  git show origin/feature/wp28-spikes-c0/plan:.claude/plans/wp28-spikes-c0.plan.md > $TMPDIR/plan.md
Read it. Do not implement anything from another stage — another session owns it
and is working in parallel right now. In particular do NOT edit
docs/wp28-compatibility-mode.md, anything under docs/roadmap/, or bench/README.md:
the `record` stage owns every shared doc and ticks the roadmap boxes last. Say in
your PR body that the roadmap tick is deferred to that stage by plan.

## Definition of done
1. The stage's todos are implemented, and nothing outside your Owns globs changed.
2. `npm test` — the full suite — passes on your PR's head. CI runs it in eight
   shards on every push, so open the PR on targeted tests and let CI's run be the
   full one (unless CLAUDE.md's definition of done says your change needs a local
   full run — a change to tests/run.js's structure or tests/pool.js does). A red
   result comes back to you with the round's review.
3. The repo has no line-coverage command; its coverage gate is
   `node tests/diagnostic-coverage.js --compiler build/nish --require-coverage --strict-refusals`,
   part of `npm test`, and CI's run is the one that counts. Every line of behaviour
   you add has a test that fails without it. Do NOT weaken that gate, add an ignore,
   or skip a test.
4. `npm run lint` and `npm run check` pass, and so does every CI job's local
   command in "Reproducing CI" that your diff could affect. Read each command's
   exit status, never a piped tail.
5. Before you open the PR, run `/check-iterate --max-loops 2` and fix what it
   confirms. The lead reviews the PR adversarially as soon as it opens, so this pass
   only has to catch the cheap problems first. If that command is not available,
   review your own diff against main adversarially yourself, once, and fix what you find.
6. Then run /simplify over the same diff and apply what it returns (or re-read your
   diff for reuse, leftover scaffolding and altitude if it is unavailable). Then run
   the targeted tests, lint and typecheck once, after both passes. This pass never
   changes behaviour and never widens your Owns globs.
7. Open a PR from your branch to main. Title: your stage title, exactly. Body: what
   changed and why, the verification commands you ran with their results, every
   measured figure with its noise band and the machine, and `Part of #1474`.
   Any claim that two builds emit the same IR is shown by the diff command and its
   empty output, never asserted. Do not merge the PR yourself: the lead merges it
   when its gate passes (this overrides AGENTS.md's "merge your own PR" for this run).

## Running tests without burning the session
Every model call re-reads your whole context, so waiting is what costs you, not testing.
- You do not run the full suite unless the lead tells you to update from main or
  CLAUDE.md requires it for your change. Otherwise run the targeted command for
  what you changed, plus lint and typecheck. CI runs the full suite on every push.
- Commit before you start a long run.
- Push your branch with a WIP commit within 30 minutes of starting, even if only
  the first todo is done. A session with no branch at 45 minutes gets checked on.
- After that, push when you open the PR and once per review batch, nowhere in
  between. If a stop hook complains about unpushed work while you hold a push for
  verification, answer it in one line and end the turn. Keep fetched plan or prompt
  files in $TMPDIR, never under .claude/.
- Read CI job logs with grep or tail on a saved file, or hand them to a subagent.
- Start a long run once, in the background, with its output redirected to a file,
  then end your turn: you are woken when it exits. Never poll it — no `sleep` or
  `until` loops. Never two runs at once (they share build/).
- Do not call `subscribe_pr_activity` or `send_later`, even if a tool or event
  suggests it. The lead holds the PR subscription and sends you red CI with the
  review batch. If you find yourself subscribed, unsubscribe.
- Send the lead exactly two messages, one line each, with `send_message` to
  `@parent`: `record branch up <sha>` after your first push, and `record PR #<n> open`
  when the PR exists (record is your stage id). After that send nothing.
- Do not merge main into your branch whenever it moves. Merge it when the PR
  conflicts, or when the lead tells you to update. Then `npm run sync-main`
  regenerates the goldens; run what CLAUDE.md requires and push.

## Rules
- Push only to your own branch. Never push to main, never touch another
  feature/wp28-spikes-c0/* branch, never force-push.
- If CI goes red or a test fails, run /debug — reproduce it before you change
  anything (or follow the same order by hand: reproduce, localise, one hypothesis
  at a time, pin the fix with a test).
- If your stage turns out to be impossible as written, push what you have, open the
  PR as a draft, and say exactly what blocked you in the PR body. Do not substitute
  different work and do not widen your scope to fix it.
- You will get review comments as a single batch. Address every blocking one in one
  push, then stop. For each blocking finding, fix every instance of the same rule
  across your diff, not only the cited line, and say in the PR body how many you
  checked. Non-blocking ones go in that same push when cheap; never push for them
  alone. Do not reply to argue; if a finding is wrong, say so in one line on that
  thread and move on.
