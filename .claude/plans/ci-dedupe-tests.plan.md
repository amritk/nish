---
name: Stop running the same checks twice per CI push
overview: Every push runs some checks in two jobs. This stops the duplicates — the sanitizer and fuzz-replay checks the test shards repeat from fuzz-smoke, the full corpus walk the Nish-runner job repeats from the test shards, the typecheck run in all eight shards, and a shard-2 benchmark that only prints — and records where each check now runs.
stages:
  - id: dedupe
    title: Delegate or drop the checks CI runs twice
    goal: Every check that ran on a push before still runs once per push, or on every release where the plan says so, and the duplicate runs are gone
    verification: npm run check && npm run lint && node tests/run.js runtime_sanitize && node tests/run.js fuzz && node tests/run.js nish-runner && node tests/run.js "ci.yml"
    todos:
      - id: delegate-sanitizers
        content: Add --delegate-sanitizers to tests/run.js so the test job hands runtime_sanitize and the fuzz replays to fuzz-smoke, with a guard that reads ci.yml — see Sanitizers
        status: pending
      - id: runner-release
        content: Gate the runner job (the golden cases, in Nish) in ci.yml to release runs only, with a run.js guard that it still runs there — see Nish runner
        status: pending
      - id: typecheck-once
        content: Run npm run check once per push, in the lint job, instead of in all eight test shards — see Typecheck
        status: pending
      - id: drop-sha256-bench
        content: Remove the shard-2 SHA-256 throughput step from the test job unless a record cites it — see SHA-256 throughput
        status: pending
      - id: move-pointers
        content: Update every doc and comment that says where these checks run — see Pointers
        status: pending
      - id: measure
        content: State the runner-minutes saved in the PR body, from the PR head's CI run against main's run 44224030613 — see Measuring
        status: pending
---

## Context

On `main` run [44224030613](https://github.com/amritk/nish/actions/runs/44224030613), one push used about 180 runner-minutes: 91 in the eight `test` shards, 36 in the three `runner` shards, and about 50 in the other jobs. Three read-only surveys found four places where the same check runs twice. They also found that `tests/link` has no true duplicate programs: the 102 `_f64` twins re-run their checks under `--number-mode f64` on purpose. Each of the four is below, with the evidence for the overlap and the seconds at stake.

| Duplicate | Runs in | Also runs in | Seconds per push |
| --- | --- | --- | --- |
| `runtime_sanitize`, `fuzz:` replays | `test` (`sanitizers` section, [tests/run.js](../../tests/run.js) 9977, 10040) | `fuzz-smoke` (`fuzz.sh --smoke` builds, replays and fuzzes every target; then `node tests/run.js runtime_sanitize`) | about 152 |
| the golden corpus | `runner` job, 3 × about 584 s plus setup | `test` shards; every runner assertion is one `tests/run.js` makes too, and the `nishRunner` section already runs the runner over `pop` on every push | about 2,150 (moves to the release) |
| `npm run check` | each of 8 `test` shards, about 7 s each | (itself) | about 49 |
| SHA-256 throughput | shard 2, 43 s, prints figures and asserts nothing about them | the `simd` section's `sha256 kernel` checks hold the output | about 43 |

## Approach

The precedent is `--delegate-fixed-point` ([tests/run.js](../../tests/run.js) 8737–8790). In CI, the `test` job passes a flag. The suite then records the check as `DELEGATED` rather than `SKIP`, and a guard reads `ci.yml` on every run, including local ones. It fails if the job that takes the check over stops running it. The sanitizer change reuses that shape, so a local `npm test` keeps the checks and CI runs them once.

## Sanitizers

- Add `--delegate-sanitizers`, honoured only under `GITHUB_ACTIONS=true` like `--delegate-fixed-point`. Under it, the `runtime_sanitize` block and each `fuzz: <target> builds and replays…` check call `delegate(name, "ci.yml's fuzz-smoke job …")`. They do not build or run anything.
- Keep the cheap `fuzz: scripts/fuzz.sh links the runtime units tests/run.js's RUNTIME_C names` check running in every case.
- Before relying on the overlap, confirm that `scripts/fuzz.sh`'s `replay` in `--smoke` reads both `tests/fuzz/corpus/<target>` and `tests/fuzz/regressions/<target>`, as the suite's `--replay` does. If it does not, the fuzz half is not a duplicate: leave it running and say so in the PR.
- Pass the flag from the `test` job's Test step.
- Guard check, beside the fixed-point one: the `test` job passes `--delegate-sanitizers` only while the `fuzz-smoke` job, with comment lines left out, runs both `scripts/fuzz.sh --smoke` and `node tests/run.js runtime_sanitize`.
- Leave `tests/shard-costs.json` alone. It is regenerated from green CI logs by `scripts/shard-costs.mjs`, so it is not edited by hand.

## Nish runner

Owner's decision at sign-off: the full corpus pass through the Nish runner moves to the release.

- Keep the `runner` job in [ci.yml](../../.github/workflows/ci.yml), and give it an `if:` so that it runs only in two cases:
  - **The release:** [release.yml](../../.github/workflows/release.yml) calls ci.yml with `uses:` on a `v*` tag, and its `release` job `needs: ci`. Inside the called workflow the ref is the tag, so `github.ref_type == 'tag'`.
  - **The Release PR:** `github.head_ref == 'release/next'` (see [release-pr.yml](../../.github/workflows/release-pr.yml)). This surfaces a broken runner before the tag is cut, rather than as a blocked publish.

  Its steps and its 3-way shard matrix stay unchanged. Check how a skipped job interacts with anything that `needs:` it or lists it as a required check, and say what you found in the PR.
- The per-push proof that the harness still works is the existing `nishRunner` section (`pop` cases, `--shard`, `--jobs`), which stays.
- Add a guard to tests/run.js, beside the shard-list check (about line 8797): the `runner` job's `if:` still names the tag condition and `release/next`, and release.yml still calls ci.yml. Without that guard, an edit could leave the job running nowhere while every row stays green. The existing shard-list guard keeps reading ci.yml's `runner` job unchanged.
- The compiler-cache `save:` and other readers of the `runner` job need no move. Confirm that, and fix any that do.
- Rewrite the ci.yml comment block at about lines 1140–1149 ("It is not a duplicate of the `test` job") to say it now runs per release, and why.

## Typecheck

- Remove the Typecheck step from the `test` job and add `npm run check` to the `lint` job, which already runs `npm ci`. The local definition of done keeps `npm run check` unchanged.

## SHA-256 throughput

- Remove the shard-2 "SHA-256 throughput on each path" step (ci.yml about 470–481) from the `test` job.
- First, grep `docs/`, `bench/` and `docs/BENCHMARKS.md` for a record that cites that step or its output as its source. If one does, keep the step and say so in the PR.
- The `simd-arm64` and `sha256-macos` copies stay: each is its own platform's only figure.
- The run.js check that holds the simd-reading steps to shard 2 must still pass.

## Pointers

Moving where a fact lives moves every pointer to it in the same PR. Grep `docs/`, `.claude/`, `AGENTS.md`, `CLAUDE.md`, `ci.yml` comments and source comments for each of these:

- `fuzz-smoke`
- `runtime_sanitize`
- `golden cases, in Nish`
- `runner` job
- `test:nish`
- `Typecheck`
- `SHA-256 throughput`

Then update what each says. Known readers include [.claude/testing.md](../testing.md) "The golden runner in Nish" (about line 340) and [docs/wp10-ci.md](../../docs/wp10-ci.md).

## Measuring

The PR body states the runner-minutes the `test` and `runner` jobs used on `main` run 44224030613 and on the PR head's run, read from the jobs API. It also lists every check that no longer runs on a push and where it now runs.

## Out of scope

- The `_f64` twins in `tests/link` (about 125 s). They are coverage of the f64 number mode, not duplicates.
- The native half of `emitTs`. It re-runs corpus programs natively, but whether it could reuse the corpus's binaries is a design question, so it is a follow-up.
- The "compiler under test" step, which takes 60–85 s per shard. That is a build-cache matter, not a test.
- Shard balance: shard 5 took 983 s against roughly 450–590 s for the others.

## Verification

`npm run check && npm run lint && node tests/run.js runtime_sanitize && node tests/run.js fuzz && node tests/run.js nish-runner && node tests/run.js "ci.yml"`. The PR head's CI must also be green on every `test` shard, with the delegated checks shown as `DELEGATED` lines and the skip count unchanged otherwise, and on `fuzz-smoke` and `lint`.
