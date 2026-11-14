You are implementing one stage of an accepted plan. Work only this stage.

Repo: amritk/nish          Base: current origin/main (it includes all three code stages: #1588, #1590 and the grammar PR); branch from it after fetching
Branch: feature/json-tokenize-gap/record   (already assigned — commit and push here, nothing else)
Tracking issue: #1584

Read the repo's CLAUDE.md and AGENTS.md, then .claude/orientation.md and .claude/testing.md, before anything else. Their rules win over this prompt wherever they disagree — commit message format, no attribution, generated files, what counts as done. Also read docs/wp38-simd.md §7 rows S6a–S6d and the "S6d, the per-value cuts" section (the byte kernels and cuts already tried and priced).

## Your stage
docs(runtime): record the JSON tokenizer result
Goal: docs/BENCHMARKS.md carries a fresh json-compare record taken after the three code stages merged, and a held-out payload table shows what real programs gained.
Owns (do not create or edit files outside these globs): docs/BENCHMARKS.md, docs/wp38-simd.md, bench/json-compare/heldout.mjs (new), bench/json-compare/run.mjs only if heldout.mjs must share a helper (prefer not), and .gitignore lines for generated payloads if needed
Verification: node bench/json-compare/heldout.mjs --check && npm run lint && node docs/check-links.mjs (if present)
This is a docs + benchmark-tooling change: it touches no std/, src/ or runtime/ file, so goldens, nish-cmp and the cookbook do not move.

Todos:
- record-heldout: Commit bench/json-compare/heldout.mjs (Node ESM, follow .claude/node.md and .claude/linting.md). It must:
  - generate the plan's held-out payloads deterministically from fixed seeds: "metrics" (~1 MB, objects like {"ts":1731571200123,"host":"web-07","cpu":0.4375,"lat_ms":[12.5,8.25,103.125],"ok":true}, floats with 1–6 decimals, seeded LCG) and "api" (~1 MB array of GitHub-API-shaped user/issue objects, 20–40 keys each, URLs, ISO dates, nulls, body strings 50–800 bytes, a third with non-ASCII text — CJK, accented Latin, emoji — and some \n and \" escapes);
  - plus "small", bench/json-tokenizer's 242-byte body;
  - with --check, hold each generated payload to a pinned SHA-256 so the documents never drift;
  - build bench/json-compare/main.ts --link --profile speed with a given compiler (--compiler, default build/nish), and print callgrind Ir per document ((N=10 − N=1)/9; small with larger N) for the tokenize workload with its checksum. With --base <compiler> it prints both and the delta.
  - The earlier workers generated equivalent payloads in scratch. If the PR bodies of #1588 / #1590 / the grammar PR describe their generator, match it so your numbers are comparable, and say whether they are byte-identical.
  - Add a heldout check to tests/run.js? NO: tests/run.js is outside Owns. --check is run by hand and named in the header comment.
- record-run: Build the compiler at current main (npm run build) and run `node bench/json-compare/run.mjs --rounds 9 --mb 128 --record`. It needs clang/clang++ (present), cargo and go. Install Rust and Go if absent (apt: cargo/rustc and golang-go, or rustup/go tarballs if the network allows). If one cannot be installed, record what runs and name the missing rows in the section's prose. Never paste old rows in. The run is long: start it once in the background with output to a file and end your turn.
  - Then, just below the json-compare marker block in docs/BENCHMARKS.md (outside the markers, since --record rewrites inside them), add a short "Held-out payloads" table: Ir per document for metrics / api / small at base f8e21091079938c8e31fe8bb9a1f406ecc7d346e vs current main, with checksums equal, produced by heldout.mjs --base. Build the base compiler from a worktree of f8e21091 (scripts/bootstrap.sh there, or the seed if it equals that source; say which).
- record-wp38: In docs/wp38-simd.md, beside the S6d row and section, add one paragraph naming which S6d cuts were built and by which PRs (#1590 for A and N3 plus one-pass numbers and SWAR; the grammar PR for whichever of G, H2, D, E2, C2/C it kept — read its PR body; #1588 for the UTF-8 block check), and the before/after tokenize ratios to yyjson from your new record.

The commit carries a Measured: trailer with the new record's Nish/yyjson ratios on the three files, against the 96899c11 record (twitter 2.02x, citm 1.60x, canada 2.18x), and the noise band per file.

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
