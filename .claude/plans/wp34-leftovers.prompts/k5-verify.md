You are implementing one stage of an accepted plan. Work only this stage.

Repo: amritk/nish          Base: main at bf63d260f5fd86cf310d44e968d008f1184fdbdf
Branch: feature/wp34-leftovers/k5-verify   (already assigned — commit and push here, nothing else)
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
perf(crypto): P-256's cached table for G and a safegcd scalar inverse for verify (K5)
Goal: P-256 sign and key generation use the fixed-base table of #1487, and verify takes s^-1 through safegcd instead of Fermat, with verify not slower and every ct_asm and Wycheproof check passing.
Owns (do not create or edit files outside these): std/crypto/p256.ts, scripts/gen-p256-table.mjs, every file #1487's diff touches, tests/link/crypto_p256*/**, tests/ct-asm.js and its p256 fixtures, bench/p256*, docs/security/crypto-ecc.md, docs/security/README.md (ECC rows only), docs/wp34-hosting-cs.md (the K5 result sections only, not the lane/status table rows or the roadmap page — k5-limbs ticks those), tests/runtime-budgets.js (your lines), tests/nish-cmp.js (DECLARED entries only)
Verification: node tests/run.js crypto_p256 && node tests/run.js ct_asm && node tests/run.js net_tls_p256 && npm run check && npm run lint
Targeted tests: node tests/run.js crypto_p256 ; node tests/run.js ct_asm ; node tests/run.js net_tls ; node tests/run.js wycheproof

Decision taken at sign-off: absorb PR #1487 (WP39 G4, "perf(crypto): a fixed-base table for P-256 sign and key generation", branch feature/wp39-complete/g4-p256-fixed-base, head 67c73b04; green and converged in another run but unmerged). Your PR supersedes it: say "Supersedes #1487" in the body and carry its Measured figures, its security-record changes and its rationale forward (read #1487's body and review comments). Do not push to #1487's branch.

Context: docs/wp34-hosting-cs.md K5 sections ("K5: P-256, the baseline" ~L387, "the result" ~L562, "the inversion — the baseline" ~L710 which defines the bar: sign faster than a22a056, verify not slower, handshake server CPU, P-256 under X25519; "the inversion — the result" ~L906). std/crypto/p256.ts has p256ScalarInverse (safegcd, #780) and the Fermat p256ScalarInvert kept for verify's public s^-1. Verify's s is public, so a variable-time safegcd is allowed there if it is clearly cheaper — say which you chose and why, and keep sign's inverse constant-time.

Todos:
- k5-take-1487: `git fetch origin feature/wp39-complete/g4-p256-fixed-base` and merge it into your branch, then `npm run sync-main` against current main; resolve and regenerate per CLAUDE.md.
- k5-scalar-safegcd: Route verify's s^-1 through safegcd (p256ScalarInverse or a variable-time twin), retire Fermat if nothing else uses it, extend ct_asm_p256 if a secret path changes.
- k5-measure: Measure sign, verify and `node bench/tls-handshake.mjs` server CPU against bf63d260 with a byte-identical twin for the noise band (Measured: trailer per .claude/testing.md); record figures in docs/wp34-hosting-cs.md's K5 result section and docs/security/crypto-ecc.md.

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
- Send the lead exactly two messages, one line each, with `send_message` to `@parent`: `k5-verify branch up <sha>` after your first push, and `k5-verify PR #<n> open` when the PR exists. After that send nothing.
- Do not merge main into your branch whenever it moves. Merge it when the PR conflicts, or when the lead tells you to update before merging — then use `npm run sync-main` (it merges, regenerates the goldens and stages them), commit, run the full suite once, and push.

## Rules
- Push only to your own branch. Never push to main, never touch another feature/wp34-leftovers/* branch, never force-push.
- If CI goes red or a test fails, run /debug — reproduce it before you change anything.
- If your stage turns out to be impossible as written, push what you have, open the PR as a draft, and say exactly what blocked you in the PR body. Do not substitute different work and do not widen your scope.
- You will get review comments as a single batch. Address every blocking one in one push, then stop. For each blocking finding, fix every instance of the same rule across your diff, not only the cited line, and say in the PR body how many you checked. Non-blocking ones go in that same push when cheap; never push for them alone. Do not reply to argue; if a finding is wrong, say so in one line on that thread and move on.
- Lessons from the previous WP34 runs: new std fields widest-first (NL9010); a test that cannot fail is blocking; a fix that only makes a CI case pass needs a loopback test that fails without it; a roadmap tick moves its design note rows in the same PR; DECLARED changelog words are capitalised like the generated notes.
