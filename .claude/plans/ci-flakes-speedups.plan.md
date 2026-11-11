---
name: CI flakes and speedups
overview: Fix the intermittent CI failures seen in the last 100 ci.yml and 40 interop.yml runs at their root, and shorten the wall-clock from push to a green ci.yml (12.2–13.1 min measured) by rebalancing the jobs on its critical path.
stages:
  - id: deflake-suite
    title: "test: fix the three intermittent failures in the test shards"
    goal: The file-server stalling-reader check, link/async_spawn_args and the crypto-bench OpenSSL mask stop failing without a code cause, each fixed at its root.
    verification: for i in 1 2 3 4 5; do node tests/run.js file-server && node tests/run.js async_spawn_args && node tests/run.js crypto-bench || exit 1; done; npm run lint && npm run lint:dead && npm run check
    todos:
      - id: file-server-stall
        content: Reproduce the 64 MiB stalling-reader timeout under load and fix its cause in examples/file-server.ts, the runtime, or the check in tests/run.js — see Deflake the suite
        status: pending
      - id: spawn-order
        content: Make link/async_spawn_args independent of which spawned job finishes first, or make the order defined — see Deflake the suite
        status: pending
      - id: crypto-bench-tie
        content: Make the crypto-bench portableRounds OpenSSL mask verdict stable at a 1.000x tie — see Deflake the suite
        status: pending
  - id: deflake-interop
    title: "ci(interop): fix the intermittent interop.yml failures"
    goal: The tshark install, the server image build and the issue-926 Chrome and quic-interop-runner failures stop failing interop.yml without a code cause.
    verification: npm run lint && shellcheck -S warning tests/interop/*.sh .github/*.sh, then interop.yml green on the PR head
    todos:
      - id: tshark-apt
        content: Install tshark through the repo's cached, retried apt-install action instead of a bare apt-get — see Deflake interop
        status: pending
      - id: interop-926
        content: Find the root cause of the issue-926 Chrome soak ERR_CONNECTION_RESET and quic-interop-runner ngtcp2 failures and fix it, or record it on issue 926 with evidence — see Deflake interop
        status: pending
      - id: server-image
        content: Diagnose the server.dockerfile build failure in run 43058056453 and make the build tolerate a transient pull failure — see Deflake interop
        status: pending
  - id: ci-critical-path
    title: "ci: shorten the critical path to a green ci.yml"
    goal: The slowest ci.yml job finishes sooner, so the median wall-clock from push to green drops from about 12.6 min to 10.5 min or less, with no check removed or weakened.
    verification: npm run build && npm run test:nish && npm run lint && npm run lint:dead && npm run check, then three green ci.yml runs on the PR whose wall-clock and shard times are tabled in the PR body against the baseline
    todos:
      - id: shard-costs
        content: Regenerate tests/shard-costs.json from the median of at least three recent green CI runs, and add the script that does it — see Shorten the critical path
        status: pending
      - id: runner-deal
        content: Deal the Nish golden-runner shards by cost so shard 3/3 is no longer always the longest — see Shorten the critical path
        status: pending
      - id: nish-cmp-split
        content: Split the x86_64 nish-cmp job so its byte compare and its elision run in parallel — see Shorten the critical path
        status: pending
      - id: simd-arm64-time
        content: Measure where the 10-min simd-arm64 job spends its time and cut it if it would be next on the critical path — see Shorten the critical path
        status: pending
---

## Context

Measured on 2026-11-11 by two read-only research passes over the last 100 `ci.yml` runs and 40 `interop.yml` runs.

**Flakes** (failures with no code cause):

| Check | Evidence | Seen |
| --- | --- | --- |
| `file-server: the 64 MiB file arrives whole to a stalling reader` (+ the peak-RSS check that cascades from it), test shards 3/4 | `timed out after 60 s` in runs 43074560527 (on main), 43076495834, 43057846266 | 3 of 13 failed runs |
| `link/async_spawn_args: exits with 0 and stdout matches expected.out` | run 43114319877: `job-1` printed before `job-2`, exit 0 | 1 |
| `crypto-bench: portableRounds fails an OpenSSL mask` | run 43086306918: `1.000x … slower in 36 of 48 paired rounds (needs … 36 of 48)` — a tie decides it | 1 |
| interop `Install tshark` | run 43114281732 (main): failed after 5 min on the mirror | 1 |
| interop Chrome wasm-arena soak, quic-interop-runner (ngtcp2) | run 42988540935 (main, docs-only commit); open issue #926 (`ERR_CONNECTION_RESET`) | recurring |
| interop `Build tests/interop/server.dockerfile` | run 43058056453, failed after 20 s | 1 |

The arm64 apt mirror failures are already being fixed by open PR #1415 and are out of scope.

**Speed** (runs 43116599932, 43109728024, 43114281714 and four more): a green `ci.yml` takes 12.2–13.1 min of wall-clock. The critical path is the slowest `test` shard (12.2–13.0 min), with the Nish runner's shard 3/3 (11.8–12.1 min), `nish-cmp (x86_64)` (9.8–10.6 min) and `simd-arm64` (~10 min) just behind it. The 8 test shards spread from 6.7 to 13.0 min, because `tests/shard-costs.json` was last measured on Nov 9 from one run. Runner shard 3/3 is the longest in every run measured. In `nish-cmp` the byte compare (303–326 s) and the elision (215 s) run one after the other in a single job.

## Approach

- **A flake fix names its cause.** Raising a timeout, adding a retry, or loosening a threshold only counts as the fix when the investigation shows the old bound was wrong, and the commit says why. AGENTS.md says "'Flake' is not a root cause".
- **The speed target is wall-clock to green.** Any runner minutes saved are a bonus. Building stage1 once and sharing it would save about 15 runner-minutes, but it puts a 2–3 min serial hop in front of every job, so it is out of scope.
- **Check names stay stable.** Every check name that reports at base still reports, under the same name. A split job adds new names; it does not rename the existing ones, which rulesets and ledgers may require.
- **Don't undo what ci.yml deliberately chose.** Its own comments explain these: main's runs are never cancelled, `--delegate-fixed-point` is used, the `seeds` → `bootstrap`/`nish-cmp` grey-not-green pairing, the macOS five-job limit, the `/3` and `/8` that tests/run.js checks against the matrix, the apt mirror, and the pinned Node version.

## Deflake the suite

**Owns:** `tests/run.js`, `examples/file-server.ts`, `tests/link/async_spawn_args/**`, `bench/crypto/**`, `runtime/**` and `std/net/**` (only if a root cause is there), `docs/security/**` (the record rows for a runtime/std change), `tests/self/goldens/checked/**`, `tests/differential/**`, `docs/guide/**` (only if a user-visible behaviour changes), `tests/nish-cmp.js` (its own `DECLARED` rows only — ci-critical-path owns the rest of the file; on a conflict keep both sides)

- **file-server** (tests/run.js `serveOnce` and its 60 s `setTimeout`, about lines 10918–11075, and `examples/file-server.ts`, added by #1403): reproduce it first. Run the section under the load a CI shard carries, for example several copies in parallel, or alongside `stress`/`taskset` on 2 cores. Then decide what is wrong: the server stalls (a backpressure or write-readiness bug, as in #1420), or the paced reader's schedule plus the load legitimately exceeds 60 s. A server bug is fixed in the server. A wrong bound is replaced by one derived from the reader's own pacing, or from progress (bytes still arriving), not from a bigger constant.
- **async_spawn_args**: read `docs/LANGUAGE.md` on whether two spawned jobs' completion order is defined. If it is not, the test compares order-independently, or the program awaits in a fixed order before it prints. If it is, the runtime breaks the rule, and that is the bug.
- **crypto-bench** (the tests/run.js section and `bench/crypto/run.mjs`): a paired-rounds verdict at a ratio of 1.000x is a coin flip. Make the mask's decision require a margin both ways, or count a tie as "not slower", so the same commit always gets the same verdict. Keep the check able to fail on a real regression, and show it does by forcing one.

## Deflake interop

**Owns:** `.github/workflows/interop.yml`, `tests/interop/**`. Merge after #1415, which also edits both; rebase onto it once it lands.

- **tshark**: install it through `.github/actions/apt-install` (the mirror, the .deb cache, the retry), the way ci.yml installs LLVM. Do not edit that action; #1415 owns it.
- **#926**: read the failing job logs from runs 42988540935 and later (save each to a file and grep it). Name the cause of the Chrome `ERR_CONNECTION_RESET` and of the ngtcp2 runner failure: a port race, a server not yet listening, a soak limit, or an upstream image. Fix it, or comment the evidence on #926 and leave it open. `Fixes #926` only if the fix covers both.
- **server image**: read run 43058056453's log. If the failure is a transient pull, retry the build step once with backoff, or pin the base image by digest. If it has another cause, fix that cause.

## Shorten the critical path

**Owns:** `.github/workflows/ci.yml`, `tests/shard-costs.json`, `tests/nish/run.ts`, `tests/nish-cmp.js`, `scripts/shard-costs.mjs` (new), `docs/wp10-ci.md`. Merge after #1415, which also edits ci.yml.

- **shard-costs**: there is no script today that turns CI job logs into `tests/shard-costs.json`. Add `scripts/shard-costs.mjs`, which reads the per-piece seconds from N saved job logs and writes the median of each. Regenerate the file from at least three recent green runs. Keep the table's shape (`link`, the dealt sections, `shardOne`, `linkFloor`) so tests/run.js's deal reads it unchanged. Document the regeneration in `docs/wp10-ci.md`.
- **runner-deal**: `tests/nish/run.ts` deals the golden corpus by count over `--shard i/3`, and shard 3 always runs longest. Deal it by cost (a cost table beside shard-costs, or the case's size as a proxy, whichever measures better) so the three finish together. tests/nish/run.ts is compiled by HEAD's compiler, so it may use any construct HEAD has.
- **nish-cmp-split**: run the byte compare and the elision as two matrix rows or two jobs. Both stay required, with the `seeds` gating unchanged. The existing `nish-cmp (x86_64-linux)` name keeps reporting.
- **simd-arm64**: measure its steps first. Change it only if, once the three items above land, it would be the longest job. The usual reason it is slow is building the compiler on the arm runner.
- **Measure, don't estimate**: the PR body tables wall-clock and per-job minutes for three runs on the PR head against the baseline above. GitHub-hosted runners vary by up to 5 min on the same shard, so one run proves nothing.

## Out of scope

- The arm64 apt mirror (#1415).
- Changing the shard count. After the stages above, `simd-arm64` and the runner sit at about 10 min, so more test shards would cost about 13 runner-minutes for little wall-clock gain. A follow-up can re-measure.
- A stage1 artifact shared across jobs (runner minutes, not wall-clock; see Approach).
- Path filters or skipping docs-only PRs: `npm test` compiles the code in `docs/AI.md` and the guide, and a skipped matrix job leaves a required check named per row pending.
- Moving the macOS or arm64 jobs to main-only.
- #927, #700, #1195 item 5: not seen failing in the window examined.

## Verification

Each stage's `verification` line, plus CLAUDE.md's definition of done. A `src/`-free change does not need the `wasi` or `performance` runs unless it touches `runtime/`, in which case run `node tests/run.js runtime` too.
