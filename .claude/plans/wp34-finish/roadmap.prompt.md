You are implementing one stage of an accepted plan. Work only this stage.

Repo: amritk/nish          Base: main at 9d0afdb2e8fc063b4c7c9474653f1fe88f178569
Branch: feature/wp34-finish/quic-congestion   (already assigned — commit and push here, nothing else)
Tracking issue: #1430

Read the repo's CLAUDE.md (and AGENTS.md, .claude/orientation.md and the guides it points to for what you touch) before anything else. Its rules win over this prompt wherever they disagree — commit message format, attribution, generated files, what counts as done. Add no attribution footer, trailer, or session link to commits, PR bodies, or comments.

## Your stage: roadmap
Title: docs: tick WP34's finished stages and WP39's G1 and G2
Goal: The roadmap and design notes say what the two runs landed
Owns (do not create or edit files outside these globs): `docs/roadmap/wp34-hosting-cs.md`, `docs/wp34-hosting-cs.md`, `docs/roadmap/index.md` (WP34's row only), `docs/roadmap/wp39-http-server.md` and `docs/wp39-http-server.md` (the G1 and G2 rows only)
Verification: node docs/check-links.mjs && npm run lint
Targeted tests: none needed for a docs-only change beyond the verification line and `node scripts/gen-reference.mjs --check`
Generated files (regenerate with the repo's tooling, never edit or hand-merge): tests/self/goldens/checked/**, tests/differential/** goldens, docs/reference/**, docs/cookbook/** regen outputs

Todos:
- Tick the merged items on docs/roadmap/wp34-hosting-cs.md, update its Done count, Next and its row in the index — see roadmap
- Update the status rows in docs/wp34-hosting-cs.md, and the G1 and G2 rows only of the WP39 roadmap page and design note, from the merged PRs' bodies — see roadmap

The plan's detail for this stage:
**Owns:** `docs/roadmap/wp34-hosting-cs.md`, `docs/wp34-hosting-cs.md`, `docs/roadmap/index.md` (WP34's row only), `docs/roadmap/wp39-http-server.md` and `docs/wp39-http-server.md` (the G1 and G2 rows only)

**Model:** sonnet

Runs last, after every other stage merged or escalated. Ticks only what merged, from both runs; an escalated stage stays unticked and is named. K5's box names 64-bit limbs, which no PR landed: tick it only if the page's own wording is met, otherwise split the line. Next says the cs waves remain, in the cs repository. Every other WP39 box belongs to the `wp39-complete` run.

What merged, all on main at 9d0afdb2 (read each PR's body, especially its "Roadmap" section where it has one, with the GitHub tools; the body is the source for the status text, the merged code is the source of truth where they disagree):
- K2, K3, K4: #1464 — the ChaCha rounds, the bitsliced AES loops and the X25519 ladder read by disassembly. AEAD-4 and `--cpu` stay open.
- K5: #1469 — a safegcd field inversion and a windowed verify. NOT landed: 64-bit limbs; a scalar safegcd for verify; caching G's table. The roadmap box names 64-bit limbs: do not tick a line whose words are not all true; split it into a ticked line for what landed and an open line for 64-bit limbs.
- T1: #1449 — secp256r1 key shares on the TLS server (direct and via HelloRetryRequest) and the TLS-4 carrier idle timeout; #1479 — the HRR handshake driven to completion in tests (closed #1472).
- T2, H1, H2 (WP39 G1): #1437 — curl --http1.1, Autobahn and Chrome over HTTP/1.1 in the interop job. (WP39 G2): #1454 — H1-2 lingering close, H2-3 SETTINGS and idle timeouts, WT-2 session clock and datagram rate. H3-5 stays open.
- Q3: #1477 — the interop runner's goodput and crosstraffic measurements, both passing for quic-go and ngtcp2.
- A1: #1458 — QUIC DPLPMTUD; the relay's 1,164-byte DATA-down limit is gone.
- Open and to be named, not ticked: the three cs items (wave 3 ×2, wave 4) — Next says they remain and that they live in the cs repository and its staging; #1485 (a stream's send buffer is sized by maxStreamData; a NAT rebind in the gap strands a transfer) belongs in the design note's open/left column for QUIC.
- Another run (`wp39-complete`, issue #1433) owns every other box and row of the WP39 page, the WP39 design note and the index. Touch only the G1 and G2 rows there and WP34's own row/count in the index. If G1 or G2 is already ticked or worded by that run when you get there, leave it.
- This is a docs-only stage: no std, src, test or workflow file changes. The lessons about std fields and nish-cmp do not apply. The PR's Roadmap section is not needed.


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

Shared files: none for this stage.

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
7. Open a PR from your branch to main. Title: the stage title above (it is a conventional-commit subject; pr-title.yml checks it). Body: what changed and why, the verification commands you ran with their results, `Part of #1430`.

## Running tests without burning the session
Every model call re-reads your whole context, so waiting is what costs you, not testing.
- You do not run the full suite unless the lead tells you to update from main. Every other time, run `node tests/run.js <filter>` for what you changed, plus lint and typecheck. CI runs the full suite on every push.
- Commit before you start a long run.
- Push your branch with a WIP commit within 30 minutes of starting, even if only the first todo is done. A session with no branch at 45 minutes gets checked on.
- After that, push when you open the PR and once per review batch, nowhere in between. If a stop hook complains about unpushed work while you hold a push for verification, answer it in one line and end the turn. Keep fetched plan or prompt files in $TMPDIR, never under the checkout.
- Read CI job logs with grep or tail on a saved file, or via a subagent that returns the failing lines.
- Start a long run once, in the background, output redirected to a file, then end your turn: you are woken when it exits. Never poll — no sleep/until loops, no second runner (they share build/).
- Do not call `subscribe_pr_activity` or `send_later`. The lead holds the PR subscription and sends you red CI with the review batch. If you find yourself subscribed, unsubscribe.
- Send the lead exactly two messages, one line each, with `send_message` to `@parent`: `roadmap branch up <sha>` after your first push, and `roadmap PR #<n> open` when the PR exists. After that send nothing.
- Do not merge main into your branch whenever it moves. Merge it when the PR conflicts, or when the lead tells you to update. Then regenerate the generated files (`npm run sync-main` does merge + goldens), run the full suite once, and push.

## Rules
- Push only to your own branch. Never push to main, never touch another feature/wp34-finish/* branch, never force-push. Never merge your PR; the lead merges.
- If CI goes red or a test fails, run /debug — reproduce before you change anything.
- If your stage turns out to be impossible as written, push what you have, open the PR as a draft, and say exactly what blocked you in the PR body. Do not substitute different work or widen your scope.
- You will get review comments as a single batch. Address every blocking one in one push, then stop. For each blocking finding, fix every instance of the same rule across your diff and say in the PR body how many you checked. Non-blocking ones go in that same push when cheap; never push for them alone. If a finding is wrong, say so in one line on that thread and move on.
