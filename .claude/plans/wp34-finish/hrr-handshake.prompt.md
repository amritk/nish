You are implementing one stage of an accepted plan. Work only this stage.

Repo: amritk/nish          Base: main at 7e241d75bba344b3b6daefbabedff844da4ef6d3
Branch: feature/wp34-finish/quic-congestion   (already assigned — commit and push here, nothing else)
Tracking issue: #1430

Read the repo's CLAUDE.md (and AGENTS.md, .claude/orientation.md and the guides it points to for what you touch) before anything else. Its rules win over this prompt wherever they disagree — commit message format, attribution, generated files, what counts as done. Add no attribution footer, trailer, or session link to commits, PR bodies, or comments.

## Your stage: hrr-handshake
Title: test(net): a TLS handshake through a HelloRetryRequest to secp256r1, to completion
Goal: Issue #1472 — the HRR path reaches TLS_STATE_CONNECTED on both sides in a test that fails if either side derives a different secret
Owns (do not create or edit files outside these globs): `tests/link/net_tls_p256/**`; and, only for a defect the completed handshake exposes, `std/net/tls.ts`, `std/net/tls/**`, `docs/security/tls.md`
Verification: node tests/run.js net_tls_p256 && npm run check && npm run lint
Targeted tests: node tests/run.js <filter> for the sections you touch
Generated files (regenerate with the repo's tooling, never edit or hand-merge): tests/self/goldens/checked/**, tests/differential/** goldens, docs/reference/**, docs/cookbook/** regen outputs, tests/differential/emit-ts-known.txt (only under CI's pinned Node)

Todos:
- Drive the HRR case in tests/link/net_tls_p256 past the server's signature to both Finished messages, compare both sides' application secrets and exchange one record each way — see hrr-handshake
- Add the negatives the path needs (a second ClientHello whose share is not the group the retry named; a second HelloRetryRequest) — see hrr-handshake
- Fix whatever the completed handshake exposes in std/net/tls.ts or std/net/tls/, with the record updated; if nothing, change no std file — see hrr-handshake

The plan's detail for this stage:
**Owns:** `tests/link/net_tls_p256/**`; and, only for a defect the completed handshake exposes, `std/net/tls.ts`, `std/net/tls/**`, `docs/security/tls.md`

Issue #1472. The HRR case in `tests/link/net_tls_p256/main.ts` stops at the server's signature (line 161); no client Finished is read after the retried ClientHello. Drive it to `TLS_STATE_CONNECTED`, compare the application traffic secrets on both sides, and send a record each way. The transcript hash across a HelloRetryRequest (RFC 8446 4.4.1, the `message_hash` synthetic message) is the likeliest thing to be wrong, and the comparison is what would show it. Put `Fixes #1472` in the PR body.

Lessons from the first run of this plan — each one cost a PR a red CI cycle or a review round:
- A field added to a class in std/ goes in widest first. CI's performance gate refuses NL9010 padding in every program that links the class; run `node tests/run.js performance` before pushing any std/ change that adds a field.
- A test that cannot fail is a blocking review finding. For every test you add, make the change it pins fail once (revert the fix locally, or break the property) and see the test go red before you trust it.
- A std/ change that moves a nish-cmp corpus program's IR needs its DECLARED entries in tests/nish-cmp.js in the same push; run nish-cmp before pushing.
- Another run (`wp39-complete`, issue #1433) is live in this repository and main moves often. Do not chase it: sync only on a conflict or when the lead says it is your turn to merge.


Reproducing CI — each CI job and the local command that runs what it runs. A red
job is reproduced with its command here, not with a nearby script that skips steps:
- lint → npm run lint && npm run check && node scripts/gen-reference.mjs --check && node docs/check-links.mjs
- test (shard N/8) → node tests/run.js <filter> for the failing section
- nish-cmp → bash scripts/fetch-seed.sh --force && node tests/nish-cmp.js
- goldens → node tests/self/goldens.js (--update to regenerate) / node tests/differential/goldens.js
- security scope → node scripts/security-scope.mjs
- interop.yml jobs (quic-interop-runner, h2spec, curl, chrome, …) → CI only; this container has no docker daemon

Known environment failures — these fail in this container whatever you change.
Do not investigate them; CI's result is the evidence for them:
- the `wasi` section without WASI_SYSROOT=/usr; anything needing a docker daemon (interop runner, Autobahn, Chrome); aarch64 NEON paths.

Shared files: `tests/run.js`, `tests/nish-cmp.js` (DECLARED entries) and `docs/security/README.md` (only your own findings' rows) may be edited by several stages; keep edits minimal and local. Do NOT edit `docs/roadmap/**`, `docs/wp34-hosting-cs.md` or `docs/wp39-http-server.md` — a later stage ticks the boxes from your PR body, so end your PR body with a "Roadmap" section giving the exact status text for your items.

Full plan, for context on how your stage fits with the others:
  git fetch origin feature/wp34-finish/plan
  git show origin/feature/wp34-finish/plan:.claude/plans/wp34-finish.plan.md > "$TMPDIR/plan.md"
Read it (its section for your stage has the detail). Do not implement anything from another stage — another session owns it and is working in parallel right now.

## Definition of done
1. The stage's todos are implemented, and nothing outside your Owns globs changed (shared files and generated files excepted, as above).
2. `npm test` — the full suite — passes on your PR's head. CI runs it on every push (8 shards), so open the PR on targeted tests and let CI's run be the full one. A red result comes back to you with the round's review.
3. `node tests/diagnostic-coverage.js --compiler build/nish --require-coverage --strict-refusals` passes; it is part of `npm test`, so CI's run is the one that counts. Do NOT lower a threshold, add an ignore, or skip a test. Every new code path has a test that would fail without it.
4. `npm run lint` and `npm run check` pass, and so does every CI job's local command in "Reproducing CI" that your diff could affect. Follow the repo's CLAUDE.md definition of done (goldens regenerated, nish-cmp DECLARED entries if IR moves, doc comments on public std declarations, gen-reference, security record in the same PR, guide page for user-visible changes).
5. Before you open the PR, run `/check-iterate --max-loops 2` and fix what it confirms. Do not loop until clean. If unavailable, review your own diff against main adversarially once and fix what you find.
6. Then run /simplify over the same diff and apply what it returns (if unavailable, re-read your diff for reuse and dead scaffolding). Then run your targeted tests, lint and typecheck once, after both passes.
7. Open a PR from your branch to main. Title: the stage title above (it is a conventional-commit subject; pr-title.yml checks it). Body: what changed and why, the verification commands you ran with their results, `Part of #1430`, and the Roadmap section.

## Running tests without burning the session
Every model call re-reads your whole context, so waiting is what costs you, not testing.
- You do not run the full suite unless the lead tells you to update from main. Every other time, run `node tests/run.js <filter>` for what you changed, plus lint and typecheck. CI runs the full suite on every push.
- Commit before you start a long run.
- Push your branch with a WIP commit within 30 minutes of starting, even if only the first todo is done. A session with no branch at 45 minutes gets checked on.
- After that, push when you open the PR and once per review batch, nowhere in between. If a stop hook complains about unpushed work while you hold a push for verification, answer it in one line and end the turn. Keep fetched plan or prompt files in $TMPDIR, never under the checkout.
- Read CI job logs with grep or tail on a saved file, or via a subagent that returns the failing lines.
- Start a long run once, in the background, output redirected to a file, then end your turn: you are woken when it exits. Never poll — no sleep/until loops, no second runner (they share build/).
- Do not call `subscribe_pr_activity` or `send_later`. The lead holds the PR subscription and sends you red CI with the review batch. If you find yourself subscribed, unsubscribe.
- Send the lead exactly two messages, one line each, with `send_message` to `@parent`: `hrr-handshake branch up <sha>` after your first push, and `hrr-handshake PR #<n> open` when the PR exists. After that send nothing.
- Do not merge main into your branch whenever it moves. Merge it when the PR conflicts, or when the lead tells you to update. Then regenerate the generated files (`npm run sync-main` does merge + goldens), run the full suite once, and push.

## Rules
- Push only to your own branch. Never push to main, never touch another feature/wp34-finish/* branch, never force-push. Never merge your PR; the lead merges.
- If CI goes red or a test fails, run /debug — reproduce before you change anything.
- If your stage turns out to be impossible as written, push what you have, open the PR as a draft, and say exactly what blocked you in the PR body. Do not substitute different work or widen your scope.
- You will get review comments as a single batch. Address every blocking one in one push, then stop. For each blocking finding, fix every instance of the same rule across your diff and say in the PR body how many you checked. Non-blocking ones go in that same push when cheap; never push for them alone. If a finding is wrong, say so in one line on that thread and move on.
