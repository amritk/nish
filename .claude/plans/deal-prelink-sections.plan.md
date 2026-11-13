---
name: Deal the small pre-link sections across the eight test shards
overview: Every `test` shard in .github/workflows/ci.yml still runs the same ~90 s of small sections before the tests/link programs (run 43375907084, after #1524). Deal the ones that are safe to deal — the performance gate, the diagnostic codes, `--fix`, and the 1–5 s sections such as term_pty, net_tls_client_tcp, fnref, net_tcp_calls and net_unix — through `DEALT_SECTIONS`, so each runs in one shard, and prove from CI logs that the per-shard pre-link time fell and no check was lost.
stages:
  - id: deal-prelink
    title: "ci: deal the small sections before the link programs across the test shards"
    goal: Each `test` shard's pre-link span (the "native run limit:" check to the first "PASS  link/" line) drops by the cost of the sections dealt away, with the 8-shard union of check names unchanged against a green main run and the longest `test` job no longer than before
    verification: npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node tests/run.js <filter> for every dealt section; one full local `npm test` in the background (≈81 `--profile wasi` checks fail locally for want of wasm32 compiler-rt/wasi-libc — CI is the evidence for those); then on the PR head every `test (…, shard N/8)` row and every runner slice green, with the union comparison and before/after table in the PR body
    status: pending
    todos:
      - id: measure-before
        content: Measure the baseline from a green main run's logs (run 43375907084 or a newer green main run) — per shard, the pre-link span and each section's cost, grouping PASS lines by the section that emits them in tests/run.js (not by name similarity) — see Measure
        status: pending
      - id: map-readers-writers
        content: For every candidate section, map what it writes under build/ and who reads it, and what it reads that another section writes — grep both the .ll and the binary names and every fs.existsSync guard; drop or pin any section with a cross-section reader — see Readers and writers
        status: pending
      - id: deal-sections
        content: Add the safe sections (or groups of them) to DEALT_SECTIONS with a filter-preserving `selected`, gate each with dealtHere(key) and delegate() so the other shards print DELEGATED lines, on caseShard / the existing dealt sections' pattern — see Dealing
        status: pending
      - id: costs
        content: Add one tests/shard-costs.json entry per new key with its measured cost and a RECOGNIZERS entry per key in scripts/shard-costs.mjs; do NOT regenerate the table and leave the `link` costs and every existing key byte-identical — see Costs
        status: pending
      - id: docs
        content: Update docs/wp10-ci.md "Shards and time limits" (what every shard still runs, the list of dealt sections) and "Where the wall clock goes" (the before/after from CI logs); grep docs/, .claude/, CLAUDE.md and comments in tests/run.js for any pointer to the old layout — see Docs
        status: pending
      - id: prove-nothing-lost
        content: After CI runs on the PR head, compare the set of PASS/FAIL/SKIP check names across all 8 shards with the green main run's union (digits normalised); trace every difference to a commit on main; check each shard's skip count and the runner job's three slice sizes against main; put the before/after per-shard pre-link table, the union result and the runner slices in the PR body — see Proof
        status: pending
---

# Deal the small pre-link sections across the eight test shards

**Owns:** `tests/run.js`, `tests/shard-costs.json`, `scripts/shard-costs.mjs`, `docs/wp10-ci.md`, `.claude/testing.md`, `.claude/orientation.md`, `.github/workflows/ci.yml`

One stage, one PR. It is a change to `tests/run.js`'s structure, so it needs one full local `npm test` (CLAUDE.md, "Definition of done") besides CI. Not to be merged by the run: the user merges.

## Measure

Read `.claude/orientation.md`, `.claude/testing.md` and `docs/wp10-ci.md` ("Shards and time limits", "Where the wall clock goes") first.

Get the logs of a green `ci.yml` run on `main` (the GitHub MCP `actions_get` `get_workflow_run_logs_url`, then `curl` and `unzip` into a fresh directory under `$TMPDIR`). In each `test (ubuntu…, shard N/8)` log, take the lines between the "native run limit:" check and the first `PASS  link/` line. Attribute each timestamp gap to the check that closed it, and group checks by **the section of `tests/run.js` that prints them** — find each check name's emitting code, do not group by prefix alone. #1524's first estimate was 3x too high because similarly named checks from other sections were lumped together. Record: per-shard pre-link span, and per-section cost (the same in every shard). Keep the script in `$TMPDIR`, not the checkout.

## Readers and writers

A dealt section runs in one shard; the other seven skip it. So a dealt section must read nothing another section writes, and nothing later (another section, a link program, a step after the suite in `ci.yml`) may read what it writes. For each candidate:

- list every path it writes (`buildDir`, `build/test/...`, temp dirs) and every path it reads;
- grep `tests/run.js` and `.github/workflows/ci.yml` for each of those names — the `.ll` **and** the binary — and especially every `fs.existsSync(path.join(buildDir, …))` guard, which skips a check *silently* when the file is missing. #1524's subagent map missed one such reader; do this grep yourself.

A section that fails the test either stays where it is, or moves to a working directory of its own first, or is grouped with its reader in one dealt key. Write the map into the PR body, one line per dealt section.

## Dealing

The machinery is `DEALT_SECTIONS`, `dealtHere(key)`, `sectionShard` and `delegate()` in `tests/run.js`; `caseShard` (section A, #1524) is the precedent for dealing part of a section. Group the 1–5 s sections into a few keys where that keeps the deal sensible, as the `tail` groups do. Every new key's `selected` keeps today's filter behaviour: `node tests/run.js codes` (and each other section's filter) still runs that section in an unsharded run. Pre-link sections are not `tail` groups — check what `tail` and `pinned` mean in `sectionShard` before choosing.

## Costs

`tests/shard-costs.json` also deals the Nish runner job's corpus (`--check-runner`); in #1524 a regeneration moved ~500 checks onto one runner slice and was reverted. Add only the new keys, with the costs measured above. Do not run `scripts/shard-costs.mjs --write`. Add a `RECOGNIZERS` entry per new key in `scripts/shard-costs.mjs` so a future regeneration measures it.

## Docs

`docs/wp10-ci.md`: "Shards and time limits" says what every shard runs before the link programs and lists the dealt sections — update both. "Where the wall clock goes" gets the before/after from CI logs (run ids linked). Moving where a fact lives moves every pointer to it (CLAUDE.md).

## Proof

On the PR head's CI run:

1. Per shard: the pre-link span before (main run) and after (PR run), and the longest `test` job's wall clock, before and after.
2. The union of PASS/FAIL/SKIP check names across all 8 shards, digits normalised, against the main run's union. Every difference traces to a commit on `main` between the two bases, not to the deal. DELEGATED lines are not checks.
3. Each shard's skip count read like a local run (`AGENTS.md` → "Trusting a test run").
4. The runner job's three slices: their sizes against main's, unchanged.
5. The ≈81 `--profile wasi` checks that fail locally pass in CI.
