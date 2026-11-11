# Worker instructions — wp39-complete (shared by every stage)

You are implementing one stage of an accepted plan. Work only that stage. Your
session prompt names the stage id; its frontmatter entry (goal, verification,
todos) and its body section in `.claude/plans/wp39-complete.plan.md` are your spec,
and the plan's Ownership table is your lane.

Repo: amritk/nish        Base: main at 203aed91 (fetch the current main)
Branch: feature/wp39-complete/<stage-id>  (already assigned — commit and push here, nothing else)
Tracking issue: #1433

Read the repo's CLAUDE.md and AGENTS.md before anything else, then the guides it
points to for what you touch (.claude/selfhost.md, .claude/testing.md,
docs/security/README.md for std/net and std/crypto). Their rules win over this
file wherever they disagree — commit message format, generated files, what counts
as done. Add no attribution footer, trailer, model name or session link to commits,
PR bodies or comments: CLAUDE.md forbids them and a hook refuses them.

## Your lane
- Owns: the globs in the plan's Ownership table for your stage. Do not create or edit
  files outside them, except the shared append files (`tests/run.js`,
  `tests/nish-cmp.js` DECLARED entries, your own rows in `docs/security/README.md`,
  `scripts/security-scope.mjs` scope lists, `THIRD_PARTY_NOTICES.md`) and generated
  files.
- Generated files (regenerate with the repo's tooling, never edit or hand-merge):
  `tests/self/goldens/checked/**` (`node tests/self/goldens.js --update`),
  `tests/differential/**` goldens, `docs/reference/**` and its routes
  (`node scripts/gen-reference.mjs`), `tests/differential/emit-ts-known.txt` (CI's
  Node only — do not regenerate it under another Node), `docs/cookbook/**`.
- Another run, wp34-finish (#1430), is editing std/net TLS, HTTP/1.1, HTTP/2,
  WebTransport, QUIC, std/crypto/p256.ts, interop.yml and the WP39 roadmap at the
  same time. Do not touch its files; do not tick roadmap boxes (the `roadmap` stage
  does that last).
- Targeted tests: `node tests/run.js <filter>` for every section you touch.

## Reproducing CI — each job and the local command that runs what it runs
- `lint` → `npm run lint && npm run check && node scripts/gen-reference.mjs --check && node docs/check-links.mjs`
- `test (…, shard N/8)` → `node tests/run.js <filter>` for the failing section
- `nish-cmp` → `bash scripts/fetch-seed.sh --force && node tests/nish-cmp.js`
- goldens → `node tests/self/goldens.js` / `node tests/differential/goldens.js`
- security scope → `node scripts/security-scope.mjs`
- `wasi` / `performance` sections, for any `src/` change → `WASI_SYSROOT=/usr node tests/run.js wasi`, `node tests/run.js performance`
- interop.yml jobs, `postgres-live` → CI only

## Known environment failures — do not investigate; CI's result is the evidence
No WASI sysroot unless `WASI_SYSROOT=/usr`; no docker daemon (interop runner,
Autobahn, Chrome jobs); no live Postgres in this container (postgres-live is
CI-only); aarch64 NEON paths; h2load is not preinstalled (apt `nghttp2-client`).

## Definition of done
1. The stage's todos are implemented, and nothing outside your lane changed.
2. `npm test` — the full suite — passes on your PR's head. CI runs it in 8 shards on
   every push, so open the PR on targeted tests and let CI's run be the full one. A
   red result comes back to you with the round's review.
3. Coverage: `node tests/diagnostic-coverage.js --compiler build/nish --require-coverage --strict-refusals`
   is part of `npm test`; CI's run is the one that counts. Every new refusal or
   diagnostic you add has a negative test. Do NOT lower a threshold, add an ignore,
   or skip a test; changing coverage configuration is out of scope, full stop.
4. `npm run lint`, `npm run check`, and every CI job's local command above that your
   diff could affect pass. Read exit status, never a piped tail.
5. Before you open the PR, run `/check-iterate --max-loops 2` and fix what it
   confirms. Do not loop until clean — the lead reviews the PR adversarially as soon
   as it opens. If that command is not available, review your own diff against main
   adversarially once and fix what you find. Do not skip it.
6. Then run `/simplify` over the same diff and apply what it returns. If not
   available, re-read your diff for reuse, dead scaffolding and altitude. Then run
   your targeted tests, lint and typecheck once, after both passes.
7. Open a PR from your branch to main. Title: your stage's `title` from the plan
   (a conventional subject — `pr-title.yml` checks it). Body: what changed and why,
   the verification commands you ran with their results, `Measured:` figures where
   the stage measures, and `Part of #1433`.

## Running tests without burning the session
Every model call re-reads your whole context, so waiting is what costs you.
- Do not run the full suite unless the lead tells you to update from main. Every
  other time run `node tests/run.js <filter>` for what you changed, plus lint and
  typecheck. CI runs the full suite on every push.
- Commit before you start a long run. Push a WIP commit within 30 minutes of
  starting, even if only the first todo is done — the branch existing is the lead's
  only sign your session came up.
- After that, push when you open the PR and once per review batch, nowhere in
  between. If a stop hook complains about unpushed work while you hold a push for
  verification, answer in one line and end the turn. Keep fetched plan or prompt
  files outside the checkout (in $TMPDIR), never under .claude/.
- Read CI logs with grep or tail on a saved file, or via a subagent. Never print a
  whole log inline.
- Start a long run once, in the background, output to a file, then end your turn;
  you are woken when it exits. No `sleep`/`until` loops, no second runner on the same
  `build/`.
- Do not call `subscribe_pr_activity` or `send_later`. The lead holds the PR
  subscription and sends you red CI with the review batch. If you find yourself
  subscribed, unsubscribe.
- Send the lead exactly two messages, one line each, with `send_message` to
  `@parent`: `<stage-id> branch up <sha>` after your first push, and
  `<stage-id> PR #<n> open` when the PR exists. After that send nothing.
- Do not merge main into your branch whenever it moves. Merge it when the PR
  conflicts, or when the lead tells you to update. Then regenerate the generated
  files (`npm run sync-main` does the merge and the goldens), run the full suite
  once, and push.

## Rules
- Push only to your own branch. Never push to main, never touch another
  feature/wp39-complete/* branch, never force-push.
- If CI goes red or a test fails, run /debug — reproduce before you change anything.
  If not available: reproduce, localise, one hypothesis at a time, pin the fix.
- If your stage is impossible as written (a measurement says no, a file you need is
  outside your lane, a design note rules the mechanism out), push what you have,
  open the PR as a draft and say exactly what blocked you in the PR body. Do not
  substitute different work and do not widen your scope.
- Review comments arrive as a single batch. Address every blocking one in one push,
  then stop. For each blocking finding, fix every instance of the same rule across
  your diff and say in the PR body how many you checked. Non-blocking ones go in that
  same push when cheap; never push for them alone. If a finding is wrong, say so in
  one line on that thread and move on.
