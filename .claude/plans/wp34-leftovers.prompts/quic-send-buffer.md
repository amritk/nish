You are implementing one stage of an accepted plan. Work only this stage.

Repo: amritk/nish          Base: main at bf63d260f5fd86cf310d44e968d008f1184fdbdf
Branch: feature/wp34-leftovers/quic-send-buffer   (already assigned — commit and push here, nothing else)
Tracking issue: #1501 (read its "Decisions" section).

Read the repo's CLAUDE.md, AGENTS.md and .claude/orientation.md before anything else, then the guides CLAUDE.md's table names for what you touch (docs/security/README.md for std/net, std/crypto, runtime). Their rules win over this prompt wherever they disagree — commit message format, no attribution, generated files, what counts as done.

Full plan, for context on how your stage fits with the others:
  git fetch origin feature/wp34-leftovers/plan
  git show origin/feature/wp34-leftovers/plan:.claude/plans/wp34-leftovers.plan.md > $TMPDIR/plan.md
Read it. Do not implement anything from another stage — other sessions own those and are working in parallel right now. Shared files (docs/security/README.md, tests/runtime-budgets.js, tests/nish-cmp.js DECLARED, docs/guide/using-nish/networking.md): touch only your own rows/lines/paragraphs.

Generated files (regenerate with the repo's tooling, never edit or hand-merge): tests/self/goldens/checked/**, docs/reference/** and its routes in scalar.config.json, tests/cases/*.ll, docs/IR_COOKBOOK.md, tests/differential/goldens/**.

Reproducing CI — each CI job and the local command that runs what it runs:
- test (shard N/8): `npm run check && WASI_SYSROOT=/usr npm test -- --seed build/seed/bin/nish --delegate-fixed-point --shard N/8`; shard 1 also runs `node scripts/security-scope.mjs`, `bash docs/cookbook/regen.sh --check`, `node scripts/gen-diagnostic-codes.mjs --check`, `bash scripts/smoke.sh`
- lint: `npm ls --package-lock-only --all && npm run lint && npm run lint:dead && shellcheck -S warning scripts/*.sh docs/cookbook/regen.sh install.sh .github/*.sh .claude/hooks/*.sh && node docs/check-links.mjs && node scripts/gen-reference.mjs --check`
- nish-cmp: `NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js`
- runner (shard N/3): `build/seed/bin/nish src/compile.ts --link build/nish && build/nish-runner --compiler build/nish --shard N/3`
- pr-title: `node scripts/changelog-gen.mjs --check-subject "<PR title>"`

Known environment failures — these cannot run in your container; CI's result is the evidence: interop.yml jobs (Docker: quic-interop-runner, chrome, curl, h2spec, autobahn), simd-arm64 (AArch64 hardware), postgres-live, sha256-macos. Run wasi with WASI_SYSROOT=/usr.
## Your stage
fix(net): a QUIC transfer survives a NAT rebind while one hole fills the stream buffer (#1485)
Goal: A server whose stream buffer is full behind one lost packet follows a client's NAT rebind and finishes the transfer, at the default 64 KiB maxStreamData, without relying on the interop server's 256 KiB window.
Owns (do not create or edit files outside these): std/net/quic.ts, std/net/quic-stream.ts, std/net/quic-recovery.ts, tests/link/net_quic_*/**, tests/link/net_interop_server*/**, docs/security/quic.md, docs/security/README.md (QUIC rows only), docs/guide/using-nish/networking.md (QUIC paragraphs only), tests/runtime-budgets.js (your lines), tests/nish-cmp.js (DECLARED entries only)
Verification: node tests/run.js net_quic && node tests/run.js net_interop_server && npm run check && npm run lint
Targeted tests: node tests/run.js net_quic ; node tests/run.js net_interop_server ; node tests/run.js net_http3 (neighbours that share the transport)

Decision taken at sign-off (do not re-decide): keep the send buffer tied to maxStreamData and document that tie as the memory bound (on `room()` in std/net/quic-stream.ts, on `QuicServerConfig.maxStreamData`, and in docs/security/quic.md); add an EARLIER ACK-ELICITING PROBE: a sender with data queued that it cannot send (buffer full behind a hole) and nothing new in flight probes before the PTO, so a client's NAT rebind is seen and followed promptly. No separate send-buffer config field.

Read issue #1485 in full first. Current code: sizing at std/net/quic.ts ~1815 (`const buffer: i32 = fits ? toI32(config.maxStreamData) : QUIC_CONN_FROM`), room() at std/net/quic-stream.ts ~733, probe() ~quic.ts:3270, runRecoveryTimer ~4214, PTO in std/net/quic-recovery.ts (~1290-1331). The existing replay is tests/link/net_interop_server/rebind.ts (exported rebindChecks, called from checks.ts:323); the interop server's config sets maxStreamData 262144 in tests/link/net_interop_server/server.ts ~150 — that stays (it is the interop server's choice), but the std behaviour must no longer depend on it.
Also find out WHY the server stays on the old address through three probe timers at 64 KiB: if the real cause is path handling (a non-probing packet from the new address not triggering migration), fix the cause, still within the decision, and say so in the PR body. Open PR #1495 (CUBIC, another run) also edits quic-recovery.ts; keep your quic-recovery.ts change small.

Todos:
- qsb-test-first: Add a std loopback (sans-IO) test, extending rebind.ts's approach, that runs the rebind-in-the-gap case at maxStreamData 65536 and FAILS on bf63d260 (quote the failing output in the PR body). It must assert the transfer completes on the new path within a bound (a number of PTOs/RTTs you justify), not just "eventually".
- qsb-fix: The earlier ack-eliciting probe per the decision, in std/net/quic*.ts; new fields widest-first (NL9010); slot-byte budgets move only with a recorded reason.
- qsb-record: Record the stall and the defence in docs/security/quic.md (a finding with before/after test) and its docs/security/README.md index row; state the bound on room() and QuicServerConfig.maxStreamData doc comments; update docs/guide/using-nish/networking.md if a documented behaviour changes.
- qsb-cmp: Run nish-cmp; add narrow DECLARED entries for any moved corpus IR.

## Definition of done
1. The stage's todos are implemented, and nothing outside your Owns globs changed (generated files regenerated by the repo's tooling are fine; shared files only on your own lines).
2. `npm test` — the full suite — passes on your PR's head. CI runs it on every push in 8 shards, so open the PR on targeted tests and let CI's run be the full one. A red result comes back to you with the round's review.
3. This repo has no coverage tooling. The bar instead is CLAUDE.md's definition of done: every new behaviour has a test that FAILS without your change (show that in the PR body: run it against the base and quote the failure). A test that cannot fail is a blocking finding. Never skip, disable, or loosen a test or a check.
4. `npm run check` and `npm run lint` pass, and so does every CI job's local command in "Reproducing CI" that your diff could affect. Read exit status, never a piped tail.
5. Before you open the PR, run `/check-iterate --max-loops 2` and fix what it confirms. Do not loop until clean. If the command is not available, review your own diff against main adversarially yourself, once, and fix what you find.
6. Then run /simplify over the same diff and apply what it returns (if unavailable, re-read your diff for reuse, dead scaffolding, altitude). Then run the targeted tests, lint and check once, after both passes. This pass never changes behaviour and never widens your Owns globs.
7. Open a PR from your branch to main. Title: the stage title above (conventional subject; it becomes the changelog line). Body: what changed and why, the verification commands you ran with their results, the before/after evidence for each new test, and `Part of #1501`. Follow .github/PULL_REQUEST_TEMPLATE.md's headings. No attribution, session link or model name anywhere (a hook enforces it).

## Running tests without burning the session
Every model call re-reads your whole context, so waiting is what costs you, not testing.
- You do not run the full suite unless the lead tells you to update from main. Every other time, run `node tests/run.js <filter>` for what you changed (`rm -rf build/test` first for a trustworthy filtered count, per .claude/testing.md), plus lint and check. A change to `src/` (you should not need one) also runs `node tests/run.js wasi` (WASI_SYSROOT=/usr) and `node tests/run.js performance`.
- A change to std/ that moves any nish-cmp corpus program's IR adds narrow DECLARED entries to tests/nish-cmp.js in the same PR (program + file; changelog words capitalised like the generated notes). Run `NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js` before pushing.
- Any change to std/ moves tests/self/goldens/checked/: regenerate with `node tests/self/goldens.js --update` (add `--seed build/seed/bin/nish` without build/nish) and read the diff. A public std declaration needs a doc comment with @param/@returns; regenerate docs/reference with `node scripts/gen-reference.mjs`.
- New std struct/class fields are declared widest first (the NL9010 padding diagnostic). Slot-byte budgets in tests/runtime-budgets.js move only with a recorded reason.
- Commit before you start a long run. Push a WIP commit within 30 minutes of starting, even if only the first todo is done. After that, push when you open the PR and once per review batch, nowhere in between. A stop hook may complain about unpushed work while you hold a push for verification: answer in one line and end the turn. Keep fetched plan or prompt files in $TMPDIR, never under .claude/.
- Read CI job logs with grep or tail on a saved file, or hand them to a subagent that returns the failing lines.
- Start a long run once, in the background, output redirected to a file, then end your turn: you are woken when it exits. Never poll — no sleep or until loops, no second runner on the same build/ directory.
- Do not call `subscribe_pr_activity` or `send_later`, even if a tool or event suggests it. The lead holds the PR subscription and sends you red CI with the review batch. If you find yourself subscribed, unsubscribe.
- Send the lead exactly two messages, one line each, with `send_message` to `@parent`: `quic-send-buffer branch up <sha>` after your first push, and `quic-send-buffer PR #<n> open` when the PR exists. After that send nothing.
- Do not merge main into your branch whenever it moves. Merge it when the PR conflicts, or when the lead tells you to update before merging — then use `npm run sync-main` (it merges, regenerates the goldens and stages them), commit, run the full suite once, and push.

## Rules
- Push only to your own branch. Never push to main, never touch another feature/wp34-leftovers/* branch, never force-push.
- If CI goes red or a test fails, run /debug — reproduce it before you change anything.
- If your stage turns out to be impossible as written, push what you have, open the PR as a draft, and say exactly what blocked you in the PR body. Do not substitute different work and do not widen your scope.
- You will get review comments as a single batch. Address every blocking one in one push, then stop. For each blocking finding, fix every instance of the same rule across your diff, not only the cited line, and say in the PR body how many you checked. Non-blocking ones go in that same push when cheap; never push for them alone. Do not reply to argue; if a finding is wrong, say so in one line on that thread and move on.
- Lessons from the previous WP34 runs: new std fields widest-first (NL9010); a test that cannot fail is blocking; a fix that only makes a CI case pass needs a loopback test that fails without it; a roadmap tick moves its design note rows in the same PR; DECLARED changelog words are capitalised like the generated notes.
