---
name: Cut CI feedback time and runner-minutes without weakening a check
overview: Measured on 39 PR runs and 15 main runs, PR feedback is set by one mis-dealt test shard and every shard links the same compiler; this rebalances the shards, builds the compiler once per commit, then adds fail-closed path selection for the side jobs behind an always-run gate — each step measured against the baseline.
stages:
  - id: shard-balance
    title: "perf(ci): deal the test shards by today's costs"
    goal: The slowest test shard takes no more than 1.25x the median shard, so the slowest shard no longer sets PR feedback time
    verification: node tests/run.js ci.yml, plus the PR's own CI run where max shard Test-step time divided by median shard Test-step time is at most 1.25
    todos:
      - id: diagnose-shard-five
        content: Find why shard 5/8 is the slowest in 40 of 48 runs (stale tests/shard-costs.json entry, an undealable group, or a missing RECOGNIZERS name) from the logs of at least 5 green post-1721 main runs — see Shard balance
        status: pending
      - id: refit-costs
        content: Regenerate tests/shard-costs.json with scripts/shard-costs.mjs --write over those runs, fixing the script or the deal in tests/run.js only if the diagnosis shows the refit alone cannot balance it — see Shard balance
        status: pending
      - id: prove-no-check-dropped
        content: Show the eight shards' summed passed/failed/skipped counts on the PR equal a baseline main run's — see Shard balance
        status: pending
  - id: compiler-once
    title: "perf(ci): link the compiler under test once per compiler input"
    goal: A job whose compiler inputs match a cached build restores it instead of linking it, and the side jobs that link their own compiler use the same cache
    verification: node tests/run.js ci.yml && node tests/self/compiler-cache.js --key --seed build/seed/bin/nish, plus the PR's CI where a run of a commit whose compiler is cached shows the compiler step under 15 s in every test shard
    todos:
      - id: diagnose-cache-miss
        content: Find why the compiler-under-test step takes about 80 s in every test shard of a tests-only PR (run 44241824047) — a key that never matches main's save, a save that never lands, or a hit that still links — see Compiler once
        status: pending
      - id: fix-cache-hit
        content: Make a PR whose compiler inputs equal main's restore main's cached compiler, in .github/actions/compiler-cache and tests/self/compiler-cache.js — see Compiler once
        status: pending
      - id: side-jobs-use-cache
        content: Move fuzz-smoke and postgres-live (and any other job that links the same binary) from npm run build to the compiler-cache action where their command needs only that binary — see Compiler once
        status: pending
  - id: scoped-lanes
    title: "perf(ci): run the side jobs only when their inputs change, behind one gate"
    goal: Side jobs whose inputs a PR does not touch skip their work, every existing check still reports a conclusion, and an always-run ci-gate job fails unless every selected job succeeded
    verification: node tests/run.js ci.yml && node tests/run.js ci-scope && node scripts/ci-scope.mjs --backtest, which prints zero misses over at least 40 merged PRs
    todos:
      - id: scope-script
        content: Add scripts/ci-scope.mjs that maps the changed paths of a pull_request event to one boolean per lane, fail-closed — see Scoped lanes
        status: pending
      - id: wire-lanes
        content: Add a scope job to .github/workflows/ci.yml and gate each side job's work on its lane, keeping every check name reporting — see Scoped lanes
        status: pending
      - id: ci-gate
        content: Add an always-run ci-gate job that fails when a selected job did not succeed or a skipped job was selected — see Scoped lanes
        status: pending
      - id: delegation-guards
        content: Update the tests/run.js ci.yml guards so a delegation (fixed point, sanitizers) still holds only while its lane runs whenever the test job delegates to it — see Scoped lanes
        status: pending
      - id: backtest
        content: Backtest the scope over at least 40 merged PRs and report misses and runner-minutes saved; open the PR as a draft with the data if the saving is under 10 percent — see Scoped lanes
        status: pending
      - id: document-ci
        content: Document the lanes, the kill switches and the gate in docs/wp10-ci.md and .claude/testing.md — see Scoped lanes
        status: pending
---

## Context

Baseline, measured from the GitHub API on 2026-11-18 (39 completed PR runs of `ci.yml` on 2026-11-17/18, 15 push-to-main runs; method and run ids in the run's tracking issue):

| measure | all PR runs (n=39) | after #1721 (n=3) |
|---|---|---|
| wall time, run created → last job done | median 18.9 min, p90 24.9 | 16.5–16.8 min |
| runner-minutes per run | median 160.9 (x64 141.8, arm 17.1, macOS 2.6) | ~127 |

- **The critical path is one shard.** `test (…, shard N/8)` finishes last in 31 of 39 runs. Per-shard medians: 1: 11.9, 2: 8.9, 3: 9.3, 4: 9.7, **5: 14.8**, 6: 8.6, 7: 8.7, 8: 7.5 min. Shard 5 is the slowest in 40 of 48 runs where every shard passed. In run 44241824047 its Test step took 850 s against shard 8's 434 s. A balanced deal brings the slowest shard near 10 min, which takes about 4 min off PR feedback.
- **Every shard links the same compiler.** "The compiler under test" took 81–83 s in each test shard, and 51 s on arm, on a PR that changed only tests (#1725). `fuzz-smoke` and `postgres-live` each spend 96–113 s in `npm run build`. Together that is about 13 runner-minutes per run.
- **The side jobs run on every PR whatever it changes.** Per run: nish-cmp ×2 (8.3 + 5.2 min), nish-cmp elision ×2 (5.1 + 3.9), bootstrap ×2 (2.8 + 2.5), NEON (6.0), SHA-256 macOS (2.6), fuzz-smoke (6.3), postgres-live (3.6). That is about 46 of the ~127 runner-minutes. Of 26 merged PRs, 17 touch none of `src/`, `std/` or `runtime/`, but only 2 are docs-only.
- The repo is public, so runner-minutes cost no money; "compute cost" here means runner-minutes and runner occupancy.

## Approach — what transfers from OpenClaw, and what does not

The OpenClaw write-up's biggest step was import-graph test selection inside a vitest suite: 98–99% fewer executed test entries. **That does not transfer to the `test` job.** There, every shard compiles every case with the compiler under test, and `tests/run.js` reads docs, the workflow and the registries. So any change can reach any check, and this plan never narrows the `test` job: it always runs all eight shards in full. What does transfer:

- **Shard packing from measured timings** (their timing refit). This repo already has the tool, `scripts/shard-costs.mjs`; the table has drifted.
- **Not repeating identical setup** (their restore-only caches and setup trimming).
- **Selection with a fail-closed fallback and an always-run gate** (their `ci-gate`, which checks "selected:result"). This applies only to side jobs with a narrow, statable read set, and only on `pull_request` events.
- **Kill switches**: a `ci:full` label and a repository variable.
- **A backtest before trusting a selector**: replay past PRs and check that nothing which failed would have been skipped.

The article itself says its numbers mix several changes, a different workload, and a median wall time that did not improve. So every stage here measures its own before/after on this repo's runs and claims nothing from theirs.

Order: `shard-balance` and `compiler-once` own disjoint files and run in parallel. `scoped-lanes` edits the files both of them own, so it starts once both have merged.

## Shard balance

**Owns:** `tests/shard-costs.json`, `scripts/shard-costs.mjs`, `tests/run.js`

- Collect at least five green post-#1721 `ci.yml` runs on `main`. Get each run's eight shard logs with the GitHub MCP `get_job_logs` tool, saved under `$TMPDIR` in the file names `scripts/shard-costs.mjs` expects. Then run the script without `--write` to see what it would deal.
- Diagnose shard 5 before changing anything. Possible causes: a piece whose real cost exceeds its table entry (for example, sections added or grown since the last refit, such as #1716's crypto benchmarks); a `tail` group with no recognizer; or a single group bigger than one shard's share.
- If the refit balances the shards, the change is the regenerated table plus whatever `RECOGNIZERS` entries it needed. Otherwise change the deal in `tests/run.js` as little as needed, and say why in the PR body.
- Correctness: the summed `passed / failed / skipped` across the eight shard summaries on the PR equals a baseline main run's. Rebalancing moves checks; it must not drop one.
- `Measured:` gives the per-shard Test-step times of the PR's run against the baseline medians above, and the `max / median` ratio (baseline 1.57).

## Compiler once

**Owns:** `.github/actions/compiler-cache/**`, `tests/self/compiler-cache.js`, `.github/workflows/ci.yml`, `docs/wp10-ci.md`

- Diagnose first, from the composite action's log lines in run 44241824047 (`compiler under test: key …`, and the restore's hit or miss). Compare its key with the key main's last run saved. Possible causes: the key never matches (it hashes something that differs between a PR's merge ref and main); main never saves (`save` only on shard 1, and a run whose shard 1 fails or is cancelled); or a hit that still links.
- Fix the cause, so that a PR whose compiler inputs equal main's restores main's binary. Caches written on `main` are readable from PRs. A PR must never write a cache that `main` later reads unless the key fully determines the binary. The key already hashes the binary's inputs; keep that property, and state it in the PR body.
- For `fuzz-smoke`, `postgres-live`, `nish-cmp-elision`'s "Build the candidate", and any other job that links `src/compile.ts` with the seed: use the cache action only where the job's command needs exactly that binary. `npm run build` is `scripts/bootstrap.sh`; check what it builds beyond stage1 before replacing it. `bootstrap`'s build is its test and stays as it is.
- Do not add a serial "build" job ahead of the shards unless measured wall time does not grow. The shards start in parallel today, and a job in front of them adds its own setup to the critical path.
- `Measured:` gives the compiler step's seconds per job on a cached commit, before and after, and the runner-minutes of a whole run.

## Scoped lanes

**Owns:** `.github/workflows/ci.yml`, `tests/run.js`, `scripts/ci-scope.mjs` (new), `docs/wp10-ci.md`, `.claude/testing.md`

**Starts after** `shard-balance` and `compiler-once` have merged.

- `scripts/ci-scope.mjs` takes the changed paths of a `pull_request` (base…head) and prints one `lane=true|false` line per lane, for `$GITHUB_OUTPUT`. Every lane's read set is written down beside it, taken from the job's own steps and the scripts they call (for example, nish-cmp reads `src/`, `std/`, `runtime/`, its corpus, `tests/nish-cmp.js` and the seed matrix).
- **Fail-closed** (CLAUDE.md, "Code that decides … fails closed"): a lane is `false` only when *every* changed path matches that lane's allowlist of paths proven not to be read. Every lane is `true` in all of these cases:
  - an unknown path, a rename out of or into a read set, or a deleted file;
  - an empty or unreadable diff;
  - any event other than `pull_request`: `push` to main, `merge_group`, `workflow_call` (the release), `workflow_dispatch`;
  - the `ci:full` label, or the repository variable `NISH_CI_SCOPE=full`;
  - a change to `.github/**`, `package*.json`, `scripts/ci-scope.mjs` or `.github/seed-*`.
- **Lanes** (candidates; the worker narrows them from the read sets and the backtest): nish-cmp, nish-cmp-elision, bootstrap, simd-arm64, sha256-macos, fuzz-smoke, postgres-live, runtime-net. The `test` shards and `lint` are not lanes: they always run.
- **Every check still reports.** Matrix jobs (`bootstrap (…)`, `nish-cmp (…)`) keep running and skip their *steps* on an unselected lane, so their check names report as before. A required check that never reports would hold a PR pending forever. The skipped job's summary says it was not selected and why. A non-matrix job may skip at job level only if its check name still appears as a concluded check.
- **Delegation stays sound.** The `test` job delegates the fixed point to `bootstrap` and the sanitizers to `fuzz-smoke`, and `tests/run.js` holds ci.yml to it. When those lanes are off, their inputs are unchanged since a `main` run that proved them. The guards are updated to say so and to fail if the lane's read set omits a path the delegated check reads.
- **`ci-gate`**: `needs` every job, `if: always()`, and fails unless each job is `success`, or is `skipped` with its lane `false`. Making it the one required check is a branch-protection setting, so it is left to a human (Out of scope); the PR body says how.
- **Backtest**: `node scripts/ci-scope.mjs --backtest <file>` takes a recorded list of merged PRs, with their changed files and failed jobs, from the GitHub API, saved under `tests/` as data. It prints, per PR, the lanes the scope selects, and counts misses: a lane that failed on the PR but would not have run. Zero misses over at least 40 PRs is required. The runner-minutes saved go in `Measured:`. If the saving is under 10% of a run's runner-minutes, the PR opens as a draft with the data, and the run escalates instead of merging complexity that buys little.

## Out of scope

- Narrowing the `test` job or its shards in any way, or skipping CI for docs-only changes in the `test` job: `tests/run.js` checks docs, so it always runs in full.
- Changing push-to-main or release coverage (both always run everything), `interop.yml` (its own path filter; median ~32 min on the PRs it runs for, so worth a separate audit), scheduled workflows, runner sizes, and branch-protection or ruleset settings.
- Deleting or merging tests. OpenClaw's test-line cleanup has no measured counterpart here.

## Verification

- Every stage: `npm run check`, `npm run lint`, `npm run lint:dead`, `node docs/check-links.mjs`, `node scripts/gen-reference.mjs --check`, `node tests/run.js ci.yml`, plus the stage's own line above. The full suite is CI's eight shards on the PR head, each shard's skip count read.
- Each PR's body carries its own before/after from its own CI run, against the baseline table in Context.
