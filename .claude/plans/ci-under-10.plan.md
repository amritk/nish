---
name: PR CI under 10 minutes
overview: Bring every PR ci.yml run under 10 minutes wall by removing the work CI still does twice and then rebalancing the test shards around what is left. Shard 1 sits on the critical path at 12–17 min on today's PRs, while every side job finishes inside 9.
stages:
  - id: dedupe
    title: Remove the work CI still does twice
    goal: Every check that runs on a PR push runs once, and benchmark-only work leaves the per-push run, each move naming what still proves it
    verification: npm run check && npm run lint && node tests/run.js "ci.yml" && node tests/run.js cases && node tests/run.js bench && node tests/run.js security-scope — then every test shard green on the PR head, with its skip line unchanged
    todos:
      - id: deal-golden-ir
        content: Deal the golden-case IR compile and check across shards in tests/run.js caseShard instead of on all 8 — see Dedupe → Golden-case IR
      - id: drop-dup-steps
        content: Drop the shard-1 ci.yml steps that tests/run.js already runs (diagnostic codes, security-scope) — see Dedupe → Duplicate steps
      - id: bench-off-push
        content: Keep the cryptoBench and bench correctness asserts on PRs and move their timing-only work to push-to-main — see Dedupe → Benchmarks
      - id: corpus-audit
        content: Audit the corpus compiles (compat-erasure, differential, self goldens) and merge only a strict superset — see Dedupe → Corpus compiles
      - id: dedupe-docs
        content: Update docs/wp10-ci.md and .claude/testing.md for every check that moved — see Dedupe → Docs
  - id: balance
    title: Rebalance the shards around what is left
    goal: No test shard is more than 1.25x the median shard, and the slowest one finishes inside about 8.5 min, so the run ends under 10
    verification: node tests/run.js "ci.yml" && node tests/run.js shard && node scripts/shard-costs.mjs --check-runner — then 3 green PR runs on the head, each under 10 min from run created to last job completed
    todos:
      - id: split-shard-one
        content: Split the shardOne lump in tests/shard-costs.json into per-section tail groups the deal can move — see Balance → shardOne
      - id: move-shard1-steps
        content: Move Smoke, Size report and the cookbook check off test shard 1 in ci.yml, into a job that runs in parallel and that ci-gate needs — see Balance → Shard-1 steps
      - id: refit-costs
        content: Refit tests/shard-costs.json with scripts/shard-costs.mjs over at least 3 green runs of the dedupe code — see Balance → Refit
      - id: shard-count
        content: Raise the shard count only if the refit projects the slowest shard over 8.5 min — see Balance → Shard count
      - id: balance-docs
        content: Update docs/wp10-ci.md for the new layout and supersede issue 1750's criteria 1-3 — see Balance → Docs
---

## Context

Today's PR runs of [ci.yml](../../.github/workflows/ci.yml) take 12.5–17 min wall, and the `test` shards are the whole critical path. In run 44466084639, shard 1's Test step took 734 s and the other shards took about 400 s. Shard 1 also runs about 90 s of steps the other shards skip. Every side job (`nish-cmp`, `bootstrap`, NEON, fuzz-smoke, postgres-live, macOS SHA-256) finishes within 9 min. The earlier runs #1720 and #1734 already did these:

- delegated the sanitizer and fuzz replays
- moved the runner job to releases
- ran the typecheck once
- cached the compiler
- dealt the shards by cost
- scoped the side lanes

So this plan does not redo any of that.

The deal is even by the table's own numbers: 503 s per shard when simulated from [tests/shard-costs.json](../../tests/shard-costs.json). Shard 1 is heavy because of what the table leaves out:

- `shardOne=372` is one lump the deal cannot split.
- Every shard compiles and checks every golden case's IR ([tests/run.js](../../tests/run.js) caseShard, around line 775).
- `cryptoBench` (311 s) and `bench` (85 s) run on every push.

Balancing alone would still land near 10.5 min (about 4,500 s over 8 shards, plus setup), so some work has to go too.

## Approach

Remove first, then rebalance. The cost table has to be refit from runs of the code that will actually ship, so `balance` measures `dedupe`'s merged result. Both stages own [tests/run.js](../../tests/run.js) and [ci.yml](../../.github/workflows/ci.yml), so they run one after the other.

**The rule for every removal:** a check leaves the PR run only if one of these holds:

- another check on the same push proves the same property, and the PR cites both
- it moves to a named lane (push to main, release, schedule), and the PR names that lane and how often it runs

Nothing is skipped, disabled or quarantined. The skip line stays as it was, and a delegation prints as DELEGATED with its job named (AGENTS.md → "Trusting a test run").

## Dedupe

Owns: `tests/run.js`, `.github/workflows/ci.yml`, `bench/**`, `tests/self/goldens.js`, `tests/differential/**`, `tests/self/goldens/checked/**` (regenerated), `scripts/ci-profile.mjs`, `docs/wp10-ci.md`, `.claude/testing.md`, `AGENTS.md`. Model: lead. Depends on: none.

**Golden-case IR.** Every shard currently compiles every case and checks its IR, and only the post-IR work is dealt (run.js:775-794). Make each shard compile and check only the cases it owns. Keep the shard-1 specimen cases. If something needs the whole corpus's IR in every shard, say so in the PR, and deal the IR check even if the compile has to stay. Measure the saving per shard with `node scripts/ci-profile.mjs`.

**Duplicate steps.** These two ci.yml steps repeat checks the suite already runs:

- `gen-diagnostic-codes.mjs --check` (ci.yml:664) repeats run.js:5180.
- `security-scope.mjs` (ci.yml:671) repeats run.js:5205, which also tests the negative cases.

Drop the ci.yml copies and keep the run.js ones.

**Benchmarks.** `cryptoBench` (311 s) and `bench` (85 s):

- Split what each one asserts (agreement, output, the kernel paths that ran) from what it only times or prints.
- Keep the asserts on PRs at the smallest input that still exercises them.
- Move the timing work to the push-to-main lane, and give it a `tests/run.js` guard that fails if that lane stops running it.
- Leave alone any figure in [docs/BENCHMARKS.md](../../docs/BENCHMARKS.md) or `docs/security/` that cites a PR run, and say so in the PR.

**Corpus compiles.** Four consumers compile the corpus: the golden IR checks, [tests/self/goldens.js](../../tests/self/goldens.js), compat-erasure (run.js:26480) and the differential (run.js:12723). Write down what each one proves. Merge two only when one strictly proves a superset of the other, for example by sharing one compile's output. Otherwise keep both and record why in the PR.

**Docs.** [docs/wp10-ci.md](../../docs/wp10-ci.md) and [.claude/testing.md](../testing.md) say where each moved check now runs. Grep for every pointer to an old location.

## Balance

Owns: `tests/run.js`, `.github/workflows/ci.yml`, `tests/shard-costs.json` (regenerated), `scripts/shard-costs.mjs`, `scripts/ci-scope.mjs`, `scripts/smoke.sh`, `docs/wp10-ci.md`, `.claude/testing.md`. Model: lead. Depends on: dedupe (development and merge — it refits costs from dedupe's runs).

**shardOne.** Break the 372 s lump into the post-link sections it holds, as dealt `tail` groups, following the earlier `tail` split at run.js:1635. Each group writes only its own directory and reads nothing another section writes (run.js:1627). Whatever has to stay on shard 1 keeps its own measured key.

**Shard-1 steps.** Smoke (46 s), Size report (34 s) and the cookbook check (7 s) move into one new side job that starts at the same time as the shards. It is added to `ci-gate`'s `needs`, to the required-check names in run.js (around line 33782) and to `scripts/ci-scope.mjs` if it is scoped. The steps that check shard-1 build products stay where they are (hardening, cpu-level, `par_map_vector`, Landlock, the crc32/adler32 bench checks), unless the new job builds the same product.

**Refit.** Run `node scripts/shard-costs.mjs --write <run-dir> <run-dir> <run-dir>` over at least 3 green runs that include `dedupe`. Those can be this PR's own runs, or main pushes after `dedupe` merged. The table is regenerated, never edited by hand.

**Shard count.** If the refit projects the slowest shard over 8.5 min including setup, go from `/8` to `/10`. That means changing all of these together:

- the matrix
- the Test step's `/N`
- the shard-name list in run.js
- the `if: matrix.shard == 2` simd steps, if the pin moves

Do not add shards to hide an imbalance the refit can fix.

**Docs.** Update [docs/wp10-ci.md](../../docs/wp10-ci.md) for the new layout. Comment on #1750 that this run's measurement supersedes its criteria 1–3. The CLAUDE.md line "about 10 minutes wall" is code-owned, so it is proposed at close-out, not edited.

## Out of scope

- The side jobs (`nish-cmp`, `bootstrap`, NEON, fuzz-smoke, postgres-live, macOS). They are already inside 9 min.
- Lane scoping in `scripts/ci-scope.mjs`, beyond adding the new job.
- The `std_postgres_async_pipeline` flake (#1750).
- Branch rulesets.
- CLAUDE.md, which is code-owned.

## Tests

Mirror the existing `"ci.yml"` workflow guards in [tests/run.js](../../tests/run.js):

- a guard that each moved benchmark's timing work still runs on its new lane
- a guard that the new side job is in `ci-gate`'s `needs`
- the existing check that the shard count matches the matrix

## Verification

`npm run check`, `npm run lint`, and the stage's `node tests/run.js <filter>` lines. The full suite gate is CI: every shard green on the head, each shard's skip line read. Runs are timed from run created to last job completed, and the method in #1734's baseline gives the shard ratio and runner-minutes.
