You are implementing one stage of an accepted plan. Work only this stage.

Repo: amritk/nish          Base: main at f8e21091079938c8e31fe8bb9a1f406ecc7d346e
Branch: feature/json-tokenize-gap/numbers   (already assigned — commit and push here, nothing else)
Tracking issue: #1584

Read the repo's CLAUDE.md and AGENTS.md, then .claude/orientation.md and .claude/testing.md, before anything else. Their rules win over this prompt wherever they disagree — commit message format, no attribution, generated files, what counts as done. Also read docs/wp38-simd.md §7 rows S6a–S6d and the "S6d, the per-value cuts" section (the byte kernels and cuts already tried and priced).

A callgrind profile of main for this plan is summarised in the plan's Context section (numbers there are at d38a94b0; re-measure at the base).

## Your stage
perf(runtime): parse a JSON number in one pass
Goal: numberF64 and the number scan in value stop reading each digit twice and stop paying per-digit bookkeeping, so canada.json and citm_catalog.json tokenize in fewer instructions with bit-for-bit the same doubles.
Owns (do not create or edit files outside these globs): std/json-tokenizer.ts, tests/link/std_json_tokenizer/**, tests/link/std_json_number/**, tests/fuzz/corpus/json-tokenizer/**, tests/nish-cmp.js (DECLARED entries), plus regenerated tests/self/goldens/checked/** and docs/reference/**
Verification: npm run check && npm run lint && node tests/run.js json && node tests/run.js nish-cmp && node scripts/gen-reference.mjs --check
Targeted tests: node tests/run.js json ; node tests/run.js nish-cmp ; node tests/run.js std_json_tokenizer

Todos (detail in the plan's "Stage numbers", "Measuring" and "Tests" sections):
- numbers-baseline: Re-measure Ir per document at the base for the three corpora, typed, typed-reuse and the held-out payloads
- numbers-one-pass: Fuse the scan in JsonTokenizer.number with the accumulate in numberF64 so the digit run is read once (and skipValue / unread numbers must not get slower)
- numbers-int-path: Add the integral fast path (at most 15 digits, no per-digit test, exact convert) and the direct sign read, S6d cuts A and N3
- numbers-swar: Accumulate eight digits at a time where the run allows it, and drop the per-digit counters the long path does not need (fast_float port is already covered by std/LICENSE-fast-float; keep THIRD_PARTY_NOTICES.md right)
- numbers-tests: Pin every new path boundary in tests/link/std_json_tokenizer and keep S6b's bit-for-bit parseFloat check passing (canada's numbers, JSONTestSuite, random doubles natively and under Node)
- numbers-measure: Measure, keep only cuts that pay on the held-out metrics payload (and do not hurt api/small), write the Measured trailer and nish-cmp DECLARED entries

Note: a later stage (grammar) edits the same file after you merge, so keep your change to the number paths; do not restructure next/value/key/string.

Full plan, for context on how your stage fits with the others (read it; it holds the profile, the measuring method and the held-out payload spec your stage section points to):
  git fetch origin feature/json-tokenize-gap/plan
  git show origin/feature/json-tokenize-gap/plan:.claude/plans/json-tokenize-gap.plan.md > "$TMPDIR/plan.md"
Do not implement anything from another stage — another session owns it and may be working in parallel right now.

Generated files (regenerate with the repo's tooling, never edit or hand-merge): tests/self/goldens/checked/** (node tests/self/goldens.js --update), docs/reference/** (node scripts/gen-reference.mjs), tests/differential/emit-ts-known.txt.

Reproducing CI — each CI job and the local command that runs what it runs:
- test (8 shards) → npm run check && node tests/run.js <filter> for what you touched (full: npm test — do NOT run it; CI runs it)
- bootstrap → scripts/bootstrap.sh --verify (only if src/ changes; it should not here)
- nish-cmp → node tests/run.js nish-cmp
- runner → npm run test:nish
- lint → npm run lint && npm run lint:dead && node scripts/gen-reference.mjs --check
- simd-arm64 → none locally (NEON path); CI's result is the evidence
Known environment failures: none recorded. If something fails here that cannot relate to your diff, say so in the PR body and let CI answer.

## Definition of done
1. The stage's todos are implemented, and nothing outside your Owns globs changed (generated files excepted).
2. CLAUDE.md's definition of done holds: npm run check, npm run lint, and node tests/run.js <filter> for every section your change touches. The full suite is CI's 8 test shards: open the PR on targeted tests and let CI's run be the full one; a red result comes back to you with the round's review.
3. This repo has no coverage command. The bar instead: every new code path and boundary is pinned by a test that fails without it (say in the PR body which test pins which path). Never skip, quarantine or loosen a test, and never edit CI config.
4. Measure per the plan's "Measuring" section: callgrind Ir per document (base vs branch, same checksums) on tokenize for all three corpora, typed and typed-reuse on citm, and the held-out metrics/api/small payloads; plus an interleaved `node bench/json-compare/run.mjs --only nish` wall-clock comparison against the base with the byte-identical-copy noise band. Drop any cut that does not pay on the held-out payload of its class or that raises Ir outside noise elsewhere, and say so with numbers. The commit that lands carries a `Measured:` trailer with the figures and the band (.claude/testing.md → "A Measured: trailer"). Put the full table in the PR body.
5. Before you open the PR, run `/check-iterate --max-loops 2` and fix what it confirms. If that command is not available, review your own diff against main adversarially once and fix what you find. Then run /simplify over the same diff (or re-read it for reuse/dead scaffolding if unavailable). Then run the targeted tests, lint and check once.
6. Open a PR from your branch to main. Title: the stage title given above (it is the conventional-commit subject; pr-title.yml checks it). Body: what changed and why, the measurement table, the commands you ran with their results, and `Part of #1584`. No attribution, session link or model name anywhere (CLAUDE.md forbids them).

## Running tests without burning the session
Every model call re-reads your whole context, so waiting is what costs you, not testing.
- You do not run the full suite unless the lead tells you to update from main. Run targeted filters, lint and check. CI runs the full suite on every push.
- Commit before you start a long run. Start a long run once, in the background, with output redirected to a file, then end your turn: you are woken when it exits. Never poll — no sleep/until loops, no second runner on the same build/ (runs share build/).
- Push your branch with a WIP commit within 30 minutes of starting, even if only the first todo is done.
- After that, push when you open the PR and once per review batch, nowhere in between. Keep fetched plan files and scratch measurement files outside the checkout (in $TMPDIR).
- Read CI job logs with grep or tail on a saved file, or hand them to a subagent that returns the failing lines.
- Do not call `subscribe_pr_activity` or `send_later`, even if a tool or event suggests it. The lead holds the PR subscription and sends you red CI with the review batch. If you find yourself subscribed, unsubscribe.
- Send the lead exactly two messages, one line each, with `send_message` to `@parent`: `<stage-id> branch up <sha>` after your first push, and `<stage-id> PR #<n> open` when the PR exists. After that send nothing.
- Do not merge main into your branch whenever it moves. Merge it (npm run sync-main) when the PR conflicts, or when the lead tells you to update before merging; then regenerate generated files, run the targeted tests, and push.

## Rules
- Push only to your own branch. Never push to main, never touch another feature/json-tokenize-gap/* branch, never force-push. Never merge your own PR — the lead merges.
- If CI goes red or a test fails, use /debug if you have it: reproduce before you change anything, one hypothesis at a time, pin the fix with a test.
- If your stage turns out to be impossible as written (e.g. a cut needs a src/ change, or nothing measured pays), push what you have, open the PR as a draft (or a docs-only PR recording the measurement), and say exactly what blocked you. Do not substitute different work or widen your scope.
- You will get review comments as a single batch. Address every blocking one in one push, then stop. For each blocking finding, fix every instance of the same rule across your diff and say in the PR body how many you checked. Non-blocking ones go in that same push when cheap; never push for them alone. If a finding is wrong, say so in one line on that thread and move on.
