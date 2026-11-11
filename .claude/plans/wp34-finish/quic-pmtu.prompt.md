You are implementing one stage of an accepted plan. Work only this stage.

Repo: amritk/nish          Base: main at 60e5be7140e1201aaa0d9a589b00dc2bf3173f4f
Branch: feature/wp34-finish/quic-pmtu   (already assigned — commit and push here, nothing else)
Tracking issue: #1430

Read the repo's CLAUDE.md (and AGENTS.md, .claude/orientation.md and the guides it points to for what you touch) before anything else. Its rules win over this prompt wherever they disagree — commit message format, attribution, generated files, what counts as done. Add no attribution footer, trailer, or session link to commits, PR bodies, or comments.

## Your stage: quic-pmtu
Title: feat(net): QUIC sends datagrams past 1,200 bytes after path MTU discovery
Goal: A1 — the relay carries DATA down above 1,164 bytes once DPLPMTUD has validated a larger path
Owns (do not create or edit files outside these globs): `std/net/quic.ts`, `std/net/quic-listener.ts`, `std/net/quic-packet.ts`, `std/net/quic-frame.ts`, `std/net/quic-datagram.ts`, `std/net/quic-recovery.ts`, `tests/link/net_quic*`, `examples/relay/**`, `docs/security/quic.md`
Verification: node tests/run.js net_quic && node tests/run.js net_http3 && node tests/run.js net_webtransport_datagram && node tests/run.js relay && npm run check && npm run lint
Targeted tests: node tests/run.js <filter> for the sections you touch
Generated files (regenerate with the repo's tooling, never edit or hand-merge): tests/self/goldens/checked/**, tests/differential/** goldens, docs/reference/**, docs/cookbook/** regen outputs, tests/differential/emit-ts-known.txt (only under CI's pinned Node)

Todos:
- DPLPMTUD (RFC 9000 14.3, RFC 8899) in std/net/quic.ts and quic-listener.ts — PADDING+PING probes, validation, black-hole fallback to 1,200 — see quic-pmtu
- Keep quic-recovery.ts's window and pacer correct for a variable datagram size — see quic-pmtu
- Lift the relay's 1,164-byte DATA-down limit and pin a loopback datagram above it — see quic-pmtu

The plan's detail for this stage:
**Owns:** `std/net/quic.ts`, `std/net/quic-listener.ts`, `std/net/quic-packet.ts`, `std/net/quic-frame.ts`, `std/net/quic-datagram.ts`, `std/net/quic-recovery.ts`, `tests/link/net_quic*`, `examples/relay/**`, `docs/security/quic.md`

`QUIC_CONN_DATAGRAM_SIZE = 1200` today (`std/net/quic.ts` ~364). DPLPMTUD with a search up to the peer's `max_udp_payload_size` and the local interface; on probe loss fall back; never exceed what was validated. Loopback's MTU lets a test exercise a larger size. The relay README's 1,164-byte note goes.

Before designing, read docs/wp34-hosting-cs.md around lines 306 and 349, examples/relay/README.md lines 140-150, and docs/security/quic.md. Keep 1,200 as the floor and the default until a probe validates more.

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
- Send the lead exactly two messages, one line each, with `send_message` to `@parent`: `quic-pmtu branch up <sha>` after your first push, and `quic-pmtu PR #<n> open` when the PR exists. After that send nothing.
- Do not merge main into your branch whenever it moves. Merge it when the PR conflicts, or when the lead tells you to update. Then regenerate the generated files (`npm run sync-main` does merge + goldens), run the full suite once, and push.

## Rules
- Push only to your own branch. Never push to main, never touch another feature/wp34-finish/* branch, never force-push. Never merge your PR; the lead merges.
- If CI goes red or a test fails, run /debug — reproduce before you change anything.
- If your stage turns out to be impossible as written, push what you have, open the PR as a draft, and say exactly what blocked you in the PR body. Do not substitute different work or widen your scope.
- You will get review comments as a single batch. Address every blocking one in one push, then stop. For each blocking finding, fix every instance of the same rule across your diff and say in the PR body how many you checked. Non-blocking ones go in that same push when cheap; never push for them alone. If a finding is wrong, say so in one line on that thread and move on.
