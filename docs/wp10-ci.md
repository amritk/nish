# WP10: CI and diagnostics

**Status:** complete. The workflow below is what `.github/workflows/ci.yml`
runs today. The diagnostic format, multi-error reporting, `--json` with stable
codes, `--emit-ast` / `--emit-checked` and `-g` all shipped and are specified
normatively in [LANGUAGE.md](LANGUAGE.md#diagnostics-and-debugging-flags);
this page keeps the design notes, the code bands, and the CI facts the
workflow's comments point at.

## CI matrix

`.github/workflows/ci.yml` runs on every pull request, on pushes to `main`
(scoped to `main` so a branch with an open pull request is not tested twice),
and through `workflow_call` from `release.yml`. A pull request's superseded
runs are cancelled, and so is a push to `main`'s run once the next merge lands:
the merge queue (below) already tested that tree and records which merge broke
`main`, and the next run, which runs every lane, tests a superset of it. Two
kinds of `main` run are pinned to a group of their own and never cancelled: the
Release PR's merge (its `chore(release):` subject, or a push adding
`changelog/`) and a re-run. Release CI is otherwise untouched: `release.yml`'s
call runs at the tag's ref. The Release PR's runs that `release-pr.yml`
dispatches at `release/next` share the group `refs/heads/release/next`, and a
newer push to that branch cancels the older commit's run, as on a pull request.
`interop.yml` follows the same rule. (Before the queue, `main`'s runs
queued instead, after the runs of #396 and #397 ended cancelled with nothing to
say which merge broke `main`.)

It also runs on `merge_group`, the merge queue's event, as does
`pr-title.yml`. A pull request's own run tests its head merged with `main` as
`main` stood when the run began, so two pull requests each green that way can
be red together: the self-goldens and the `.ll` they share move without a
textual conflict (#549 after #547). The queue runs CI on each one on top of
`main` and everything queued ahead of it, on a temporary
`gh-readonly-queue/main/*` branch, and merges only what passed there. The queue
itself is switched on in `main`'s ruleset ("Require merge queue"), with the
required checks this workflow and the two title and body checks report; those
two skip their step in the queue, where there is no pull request in the event,
and report success, since the title and body were checked on the pull request.
`interop.yml` has no `merge_group` trigger: a queue run ignores path filters,
so it would run the interop matrix on every merge. Its jobs therefore cannot be
required checks once the queue is on. Before merging, an open pull request runs
`npm run sync-main` (`scripts/sync-main.mjs`): it merges `origin/main`,
regenerates `tests/self/goldens/` and the differential register, and stages
them for review.

| Job | Runner | What it does |
| --- | --- | --- |
| `test (ubuntu-latest, shard <i>/9)` | Ubuntu, LLVM 18 from apt (`clang-18 lld-18 llvm-18`, `valgrind`, `wasi-libc`, `libclang-rt-18-dev-wasm32`) | `npm ci`, the seed (`scripts/fetch-seed.sh`), `npm test -- --seed build/seed/bin/nish --delegate-fixed-point --delegate-sanitizers --delegate-bench-timing --shard <i>/9` ([shards](#shards-and-time-limits)), then, in shard 2 only, the steps that read the `simd` group's drivers and kernel lines, and in shard 1 only the stage1 the suite built kept as `build/nish` and used for `bench/crc32.mjs --check` and `bench/adler32.mjs --check` |
| `examples` | Ubuntu, LLVM 18 from apt (`clang-18 lld-18 llvm-18`, `wasi-libc`, `libclang-rt-18-dev-wasm32`) | beside the shards, with the compiler from their cache key (linked here on a miss, saved only by shard 1): `scripts/smoke.sh` over every example with a `main`, `docs/cookbook/regen.sh --check`, and the size report in the job summary. They ran after the suite in shard 1 until #1797, about 80 s on the critical path of every run. Not scoped: it runs on every event |
| `test (macos-latest)` | — | **commented out** of the matrix, on four named checks (below). `bootstrap` has had darwin rows since the 0.4.0 seeds, `runtime-net` runs the network runtime on a mac; `nish-cmp` is Linux-only |
| `seeds` | Ubuntu | runs `.github/seed-matrix.sh`: asks the newest release which seed assets it carries and emits the `bootstrap` and `nish-cmp` matrices. Red only when a seed that is due is missing |
| `bootstrap (<asset>)` | the row's `runner` from `.github/seed-targets.json` | `NISH_BOOTSTRAP=<seed> scripts/bootstrap.sh --verify` — the only check of WP19's rolling freeze — then `tests/nish/cli.ts` against the stage2 it built. Skipped by its lane on a pull request that does not need it ([scoped lanes](#scoped-lanes)) |
| `nish-cmp (<asset>)` | the row's `runner` | WP19 G2.1: `tests/nish-cmp.js` compiles the corpus with the last release and with HEAD and requires every byte to match, then `tests/differential/fuzz.js --stage1` does the same for 200 random programs and `--emit-ts` holds them to the TypeScript round trip. Rows only for the Linux (`ubuntu-*`) seeds, and none until the newest release is at or after `cmpSince`. Skipped by its lane on a pull request that does not need it ([scoped lanes](#scoped-lanes)) |
| `nish-cmp elision (<asset>)` | the row's `runner` | `tests/differential/soundness.js`: the same candidate, linked by the same seed, builds the corpus and 600 generated programs with and without every proof-backed elision, and both must print and exit alike (the generated ones under ASan too). It ran after the byte compare in `nish-cmp` until that job was among the last to finish (330 s of compare and 221 s of elision); beside it, each is about half. Same rows and gating as `nish-cmp`. Skipped by its lane on a pull request that does not need it ([scoped lanes](#scoped-lanes)) |
| `runner (shard <i>/3)` | Ubuntu, LLVM 18 | **only on the release**: on the Release PR (`release/next`) and on the `v*` tag, where `release.yml`'s `ci` job calls this workflow and `release` needs it, unless the Release PR's dispatched run already tested the tag's tree ([The release reuses the Release PR's run](#the-release-reuses-the-release-prs-run)). It took about 36 runner-minutes a push ([run 44224030613](https://github.com/amritk/nish/actions/runs/44224030613)) for assertions the `test` job makes too; on a push the harness itself is held by the `nishRunner` section's `pop` run. It builds the compiler from the seed and runs a third of the golden corpus through `tests/nish/run.ts`, the harness written in Nish, one process per core (`build/nish-runner --shard <i>/3`, whose `--jobs` defaults to the core count up to 8: four on a hosted runner), linking each `tests/link` program under the profile `tests/run.js` gives it (`tests/speed-link.txt`). A regression in the runner, or in `readdirSync` / `spawnSyncTo` / `monotonicNanos`, fails only here: on the Release PR's run, before the tag is cut (the run `release-pr.yml` dispatches at `release/next`, since its `GITHUB_TOKEN` push raises `pull_request` runs that wait as `action_required`), and otherwise first at the tag |
| `runtime-net (macos-latest, shard <i>/3)` | macOS (AArch64), LLVM 18 from Homebrew (`llvm@18`) | #358: `runtime/runtime-net.c`'s Darwin branch (kqueue, `SO_NOSIGPIPE`, errno translated to Linux's numbers), run. In shard 1, `node tests/run.js runtime_test` compiles `tests/runtime-test.c` with every runtime source under `-std=c11 -Wall -Wextra -Werror -O2` and runs it, plain and with `-DNISH_THREADS=1 -pthread`; then, in every shard, `node tests/run.js net_ --shard <i>/3 --delegate-ir-checks` ([shards](#shards-and-time-limits)), which links and runs each program and delegates the checks of its compile (goldens, `llvm-as`, `opt`, declares, `--emit-panics`, rejections) to `test`, which makes them on Linux. Each run's summary line and every skip, with its reason, go to the job summary |
| `scope` | Ubuntu | `node scripts/ci-scope.mjs`: decides which [scoped lanes](#scoped-lanes) this run needs and writes one `<lane>=true\|false` output per lane |
| `ci-gate` | Ubuntu | `if: always()`, needs every other job: `node scripts/ci-scope.mjs --gate` fails unless each one succeeded or was skipped by its own `if:` ([below](#scoped-lanes)) |
| `lint` | Ubuntu | `npm ls --package-lock-only`, `npm run check` (`tsc`, once a push: it ran in all eight `test` shards before), `npm run lint` (filenames and Biome), `npm run lint:dead` (knip), `shellcheck -S warning` over the repository's shell scripts, and `node docs/check-links.mjs` |

Every job that compiles anything compiles with `src/`, built from the seed:
there is no other compiler in the repository. The jobs that compared two
implementations — `batch-parity`, `parity-select`, `parity-changed`, the
nightly `parity.yml` and `release.yml`'s `ddc` job — were deleted with stage0's
`src/` in WP19 R6 ([below](#the-parity-run-retired)). Diverse
double-compiling came back as a monthly job in `rebuild.yml`, which builds the
line of releases from the `ddc-0.6.0` tag
([security/supply-chain.md](security/supply-chain.md), SC-29).

The other workflows: `rebuild.yml`, which builds the latest release again
from its tag every week and compares it with what was published (SC-28);
`release.yml` and `release-pr.yml`
([wp12-release.md](wp12-release.md#release-procedure)); `pr-title.yml`, which
checks a pull request title with `changelog-gen.mjs --check-subject`; and
`ct-timing.yml`, a weekly dudect-style timing test of the constant-time crypto
code that files an issue rather than failing a pull request.

`--delegate-fixed-point` makes `tests/run.js` record its own copy of the
bootstrap fixed point (`IR(stage1) == IR(stage2)`, `stage3 == stage2`, about
80 s of the critical path) as **delegated** to the `bootstrap (x86_64-linux)`
row, which asserts the same equalities with the same seed in the same run. It
is a third count beside passed and skipped, honoured only under GitHub Actions
on a host with a seed target, and a check fails if `test` asks for it while
`bootstrap` has stopped running `--verify`, or while the `bootstrap` lane would
skip a pull request that changes a file the fixed point reads. A local
`npm test` always runs the fixed point.

`--delegate-sanitizers` does the same for the `sanitizers` section: its
`runtime_sanitize` rows and each target's `fuzz: <target> builds and replays…`
row are delegated to `fuzz-smoke`, whose `scripts/fuzz.sh --smoke` builds and
replays every target's corpus and regressions and which then runs
`node tests/run.js runtime_sanitize`, failing on a skip. A target with no
corpus is still replayed by the suite, since `fuzz.sh` accepts one with only
regressions, and the `fuzz.sh links the runtime units` check always runs. A
check fails if `test` asks for the delegation while `fuzz-smoke` stops running
either command, or while the `fuzz` lane would skip a pull request that changes
`src/`, `std/`, `runtime/`, `scripts/fuzz.sh` or any file under `tests/` but
`tests/ci-scope/` (`runtime_sanitize` compiles `tests/runtime/range-test.c`, a
file the hand-picked list this replaced missed). Another check holds the `runtime_sanitize` step to
`set -o pipefail`, a non-zero `passed, 0 failed` line and no `SKIP` line, with
no `|| true` or `continue-on-error` (#1724).

### Scoped lanes

A pull request that touches only the docs used to pay for every side job:
about 42 of a run's ~119 runner-minutes go to seven jobs that read only the
compiler and some test trees. Those jobs are now **lanes**. The `scope` job runs
`scripts/ci-scope.mjs`, which reads the pull request's changed files and labels
from the API and writes `<lane>=true|false` and a one-line `why=`: the reason
every lane runs (a `ci:full` label, a deleted file, a path that changes what CI
runs, ...), else `lanes off: <names>; ...` naming each lane that is off, else
`every lane reads a changed path`. A lane job `needs: scope` and gates
every work step on `needs.scope.outputs.<lane> != 'false'`, so an empty or missing
output runs it. If `scope` itself fails, GitHub skips the jobs that need it, and
`ci-gate` fails on that. When the lane is off, the job's first step writes why to the job
summary, and the job still reports success under its usual name, so no required
check goes missing. A lane that is off runs on `ubuntu-latest` for those few
seconds, whatever runner its rows would otherwise take.

| Lane | Jobs | Runs when a changed path is under |
| --- | --- | --- |
| `nish_cmp` | `nish-cmp` | the compiler (`src/`, `std/`, `runtime/`, `scripts/`, `bin/`, `nish-capabilities.lock.json`) or the corpus (`tests/cases`, `examples`, `docs/cookbook`, `bench`, `tests/parser`, `tests/differential`, `tests/link`, `tests/self`, `tests/nish-cmp.js`, `tests/pool.js`, `tests/driver.c`, `CHANGELOG.md`, `changelog/`) |
| `elision` | `nish-cmp-elision` | the same as `nish_cmp` |
| `bootstrap` | `bootstrap` | the compiler, `tests/nish/`, `tests/self/`, and `tests/cases/` and `tests/link/` (the built `nish-cli` compiles fixtures from both) |
| `sha256_macos`, `fuzz` | `sha256-macos`, `fuzz-smoke` | the compiler, any file under `tests/` but `tests/ci-scope/` (a `tests/run.js` section can open any fixture there), `bench/`, `examples/` |
| `simd` | `simd-arm64` | the same as `sha256_macos`, and `docs/LANGUAGE.md` (the `crc32 kernel` section gzips it) |
| `postgres` | `postgres-live` | the compiler, `tests/self/` (the compiler-cache action), `tests/postgres/`, `bench/techempower/` |
| `gfx` | `gfx` | the same as `sha256_macos` (its `tests/run.js gfx` section, `scripts/fetch-gfx.sh` under the compiler's `scripts/`, and the `bench/` and `examples/` programs it builds); about 3.2 runner-minutes a run, from [run 45857452100](https://github.com/amritk/nish/actions/runs/45857452100) |
| `gfx_macos` | `gfx-macos` | the same as `gfx`; 4.5 runner-minutes on that run |

**Deferred lanes.** Four of those lanes run code no other job runs:
`simd` is the one run of the NEON, ARMv8 AES/PMULL, SHA-256 and CRC32 paths,
`sha256_macos` of runtime-sha256.c's Apple detection, `gfx_macos` of the
Cocoa and Metal link, and `postgres` of a live server, which a recorded
exchange can disagree with. Each is `pullRequests: false` in
`scripts/ci-scope.mjs` with a list of `pullRequestPaths`: the kernels and
their lowerings, the gfx runtime, the postgres client and its tests, and
`scripts/build.sh`. A pull request runs the lane when it changes one of
those paths and its read set also reads the change, and otherwise defers it.
It also defers the other platforms' rows of `bootstrap` and
`nish-cmp-elision`: `scope` writes `rows=native`, and those two jobs take
only the `seeds` job's x86_64-linux row (`rows_native`, `cmp_native`), so
their aarch64-linux rows are not in the pull request's run at all. A
deferred lane's job still reports under its name, its steps skipped, with
the reason in its summary. `nish-cmp` keeps every row: its aarch64-linux row
failed alone on two of the recorded pull requests (#1658, #1714), each a
difference that pull request had to declare.

What a pull request defers runs on the push to main, the merge queue, the
Release PR's dispatched run and the release, which run every lane and every
row; `ci:full`, NISH_CI_SCOPE=full, a change to `.github/**`, `package.json`
or `scripts/ci-scope.mjs`, and a file list the script cannot read run them
on the pull request too. The cost is where a failure in deferred code shows,
and when: a newer merge cancels a push to main's run (the concurrency group
above), and a newer merge force-pushes `release/next`, which cancels the
Release PR's, so on a busy day the first of these to finish can be the
release's own `ci` job at the tag, and a failure there blocks the release.
A change to the code a deferred lane exists for is what its
`pullRequestPaths` keep on the pull request. `byReadSet` is the read-set
rule alone, before the deferral; the command list below is checked against
it, so a deferred lane's read set is still proven for the runs that use it,
and the backtest counts a failure as deferred only where the read set ran
the lane, so one it skipped is still a miss.

The rule fails closed. A lane is off only when **every** changed path is on that
lane's allowlist of paths it does not read (`docs/`, `web/`, `skills/`,
`.claude/`, the top-level prose files and the other lanes' test trees), and
the read set wins over the allowlist. A path on neither list turns every lane
on. Each list was read from the code of every command the lane runs, composite
actions included (`node tests/run.js ci-scope` pins a file per command, 27
commands across the nine lanes, the compiler-cache action counted once for
each of the seven lanes that run it). That check proves only that a change to a
listed file turns its lane on: it cannot find a read nobody listed. Some were also traced with `strace -f` on
x86_64 Linux: the compiler-cache key, the `nish-cli` build and run,
`soundness.js`, the `simd`, `float-corpus`, `sha256_hw` and five kernel
sections of `tests/run.js`, and the four `bench/` checks; `fuzz.js --stage1`
and `scripts/fuzz.sh --smoke` only up to the build they need. The
`runtime_sanitize` trace ran on a host with no sanitizer runtime, so its five
ASan and UBSan checks were skipped and the files they compile, such as
`tests/runtime/range-test.c`, were never opened: that trace shows nothing about
them. The lanes that run `tests/run.js` therefore read all of `tests/` rather
than a traced list, and `node tests/run.js ci-scope` fails if one of them would
skip any file there but `tests/ci-scope/`.
`bootstrap.sh --verify`, `tests/nish-cmp.js`, `fuzz.js --emit-ts` and the
postgres scripts were not traced, and no command was traced on AArch64 or
macOS. Every lane runs on:

- any event other than `pull_request`: a push to `main`, `merge_group` and
  `workflow_call` (the release);
- the `ci:full` label (add it, then use **Re-run all jobs**: `scope` reads the
  labels again from the API, and re-running only the failed jobs does not
  repeat `scope`), or the `NISH_CI_SCOPE` repository variable set
  to `full` (the kill switch for every pull request at once). Both match
  without regard to case;
- a changed-file list that is empty, truncated or cannot be read, a deleted
  file, an unknown status, or a rename that moves a file into or out of a
  lane's read set;
- a change to `.github/**`, any `package.json` or `package-lock.json`, or
  `scripts/ci-scope.mjs` itself.

`lint` is not a lane and does not wait for `scope`. The `test` shards and
`examples` wait for its `suite` output and skip only when it is `false`: a
pull request every changed path of which is one the whole suite never reads
(`SUITE_UNREAD` in `scripts/ci-scope.mjs`, today `.claude/plans/**`). Such a
pull request runs `lint` (docs/check-links.mjs reads every Markdown file),
and `ci-gate` expects the two skips; any other change, event or label runs
both. `node tests/run.js ci-scope` fails if any file of tests/, scripts/,
bench/, src/, std/ or .github/ names a path under it outside a comment. A
path joins that list only with the same proof: the suite reads docs/,
CLAUDE.md and most of `.claude/` (its checks compile the guide's examples
and pin rules' text), so a docs change runs it.

**`ci-gate`** needs every other job, runs `if: always()`, and fails unless each
one succeeded or was skipped by its own `if:` on this run (`runtime-net`, and
`runner`, `bootstrap` and the `nish-cmp` jobs when their matrix is empty). That
is one check that is red whenever any selected job is. To make it the only
required check, edit `main`'s ruleset under "Require status checks to pass":
add `ci-gate`, then remove the per-job checks. Keep the title and body checks
from `pr-title.yml`. Branch protection is not changed by this workflow.

`node scripts/ci-scope.mjs --backtest` replays the merged pull requests in
`tests/ci-scope/backtest-prs.json` (60 of them, each with the jobs that failed
on its runs) and fails on a **miss**: a lane it would have skipped whose job
failed on that pull request. A failure recorded as an infrastructure flake, with
its log line, is printed as excused. On those 60 it skips 17.5 of the lanes'
41.6 runner-minutes per pull request run (14.7% of a ~119-minute run), with no
miss and one excused flake (#1666's `fuzz-smoke`). That no-miss result is
evidence only for `nish_cmp`, `fuzz` and the jobs that always run: the 60 hold
no failure of `bootstrap`, `nish-cmp-elision`, `simd-arm64`, `sha256-macos` or
`postgres-live`, so for those five lanes the replay shows what they skip, not
that skipping is safe. `node tests/run.js ci-scope` runs the replay and
pins every case that must run everything, and `node tests/run.js ci.yml` pins
the lanes the `test` job delegates to.

`interop.yml` runs on a pull request only with the `ci:interop` or `ci:full`
label (adding either starts it: the trigger takes `labeled`), and then only
when a changed file matches its `pull_request.paths`. Another label's
`labeled` event runs nothing, in a concurrency group of its own, so it never
cancels a labelled run in flight. A re-run reads the labels its event
carried, so adding the label, not re-running an older run, is what starts it. Its fourteen jobs took
16 to 20 minutes, longer than `ci.yml` (run 46080094444: 16.4 minutes; its
`arena` soak is ten minutes by design), on every pull request that touched
one of those paths. The push to main runs it unfiltered, `release-pr.yml`
dispatches it at `release/next` beside `ci.yml`, and the release's tag runs
it with the compiler just published. The paths are the labelled run's scope,
and GitHub's, not this script's. Those paths are its
read set, so the same rule applies to them. `ci-scope.mjs`'s `workflowPaths`
reads the list, and `node tests/run.js ci-scope` fails when a file the `grpc`
job opens is not on it (WP72 S4). That covers the workflow,
`server.dockerfile` itself, `run-endpoint.sh`, `tests/interop/grpc/`, and the
server's sources, followed through every relative and `nish/` import. The
`build` job's own reads (`scripts/`, `src/`, `runtime/`, `install.sh`,
`package.json`) are shared with every interop job and are not checked.

Those paths leave most of `src/` and `scripts/` off on purpose, so a push to
`main` runs every interop job unfiltered: that run is what catches a compiler
change that breaks a live peer. The one push it skips is the Release PR's
merge (a `chore(release)` subject), which changes only the release notes and
the version, and whose tag `release.yml` runs this workflow on anyway, with
the compiler just published. The skip is the `build` job's `if:`; every other
job needs `build` and skips with it.

Each `quic-interop-runner` client deals its cases into rows that run side
by side: ten tests, the two rebindings, goodput and crosstraffic. In one
row per client they took 21 to 28 minutes of the runner step
([run 45866563974](https://github.com/amritk/nish/actions/runs/45866563974)),
the longest job of the workflow. A row reaches its first case some 4.5
minutes into the run (the image's build, then the row's setup). There,
ngtcp2's cases took 2.2 minutes for the ten tests, 3.9 for the rebindings, 4.7
for goodput's five transfers and 17.2 for crosstraffic's five. Most of a
measurement's time is the runner reading the trace through pyshark after the
transfer, 43 of goodput's 56 s. crosstraffic's row ends some 22 minutes in,
so it runs only on a release's tag, where release.yml passes
`crosstraffic: true`. A pull request's run and main's end near 10 minutes
with goodput's row, whose five transfers must every one complete as well.

### Link-program results across runs

The `tests/link` programs are about two fifths of a `test` shard's suite:
in [run 46080094445](https://github.com/amritk/nish/actions/runs/46080094445)
in the eight shards whose logs are whole they took 155 to 287 s of the 419
to 591 s from the first check to the summary (1668 of 4148 s together),
against 10 to 48 s for the golden cases and the rest for the sections. A pull request's run no longer builds one whose inputs have not
changed since a run in which it passed. `node tests/run.js --link-results
<file>` reads and rewrites a file of records, one per program, each the
checks that program printed and the key they were printed under
(`tests/link-results.js`); a program whose key matches replays its record,
under a `REPLAY link/<name>: ... (key <12 hex>)` line, and the run's summary
says how many replayed. The key covers:

- the compiler under test, byte for byte, and the suite's flags other than
  `--shard`, `--jobs`, `--seed` and `--link-results`;
- tests/run.js and every file it imports, followed through relative imports:
  an edit to the suite's code replays nothing;
- every file under std/ and runtime/, scripts/build.sh, package.json and
  nish-capabilities.lock.json. All of std/, rather than the modules a compile
  writes: a library of generics writes no `.ll` of its own
  (`std/collections.ts`), so no output names it;
- the toolchain and the tools a run drives by `--version` (`TOOLS`), Node,
  the platform, architecture, kernel release, glibc, the CPU's model and
  feature flags, the core count, and the variables a build or a run reads
  (`ENV_KEYS`: `HOME`, `TZ`, `PATH`, `LANG`, `CC`, `WASI_SYSROOT`, ..., and
  every `NISH_*`);
- the program's directory and every tests/link directory it imports by a
  relative path, transitively, each whole.

A record is kept only when every one of its checks passed and it logged
nothing, and it replays for a week (`MAX_AGE_MS`) from the run that built
it: a replay carries that time forward, so the clock (a certificate's
validity, a date) is checked at least weekly. A program is never kept when a
later section reads its output (`LINK_READ_LATER`), when its compile wrote
no module (a rejection, which costs a twentieth of a second), when a
compile's module names a source outside std/ and its directories, when a
relative import leaves tests/link for anywhere but std/, or when any file of
its directory names a path of the checkout outside those and the base key's
files: a string starting with a root-level entry (`"tests/json-suite/..."`,
`` `runtime/${f}` ``, `'README.md'`), a non-import string starting with
`../`, or a word of `args`. Such a program can read that file at run time,
which no compile names. On `1c6d6d39`'s tree, of the 1479 programs with a
`main.ts`, 348 are rejections, 55 import outside tests/link and std/, and
131 name such a path; the other 945 can be kept. A path a program builds
from pieces at run time is the one read the key cannot see; that is the gap
the push to main closes, below.

In CI, each `test` shard restores its file from the Actions cache before the
suite on a **pull request only**: its own last push's file first (a cache is
scoped to the ref that saved it), else `main`'s. A pull request's run and
a push to main's save the file after the suite (no other event's is ever
restored), red ones too, since only passing records are in it, and
cancelled ones, since the suite writes it whole by a rename once the link
programs are done. So a pull request's second push builds the programs its
change reaches and the ones that failed, and its first push replays what
`main`'s last saved run passed with the same inputs. A change to `src/` or to
one of the `std/` modules the compiler imports is a new compiler and replays
nothing; a change to anything in std/, runtime/ or tests/run.js replays
nothing either. The push to main, the
Release PR's dispatched run and the release never restore a file, so they
build every program: a key that missed a read fails there.

`node tests/run.js link-results` moves each input of the key alone, in a
checkout in miniature, and requires a miss (and requires none for the flags
that only place work, a variable no run reads and a file no program reads), pins what is never kept, and holds the `test` job's restore,
flag and save to the above. `scripts/shard-costs.mjs` refuses a log with a
`REPLAY` line, whose programs cost nothing: refit the costs from pushes to
main.

### Shards and time limits

Every job stops at 15 minutes (`timeout-minutes`) but `test` (25),
`runtime-net` (20), interop.yml's `arena` (25: its Chromium soak of
examples/wasm-arena runs ten minutes by design, docs/wp50-wasm-host.md §10)
and its `quic-interop-runner` rows (30),
and every LLVM install step at 5 (10 for Homebrew). Without them a job that hangs runs to GitHub's six-hour
limit: on #502 three jobs waited on one `apt-get update` fetch from
archive.ubuntu.com from 19:22 to 01:22 and no test ran. apt has no timeout of
its own, so every `apt-get` is also handed `$APT_OPTS` (30 s per connection,
three retries) from the workflow's `env`. That bounds an idle mirror, not a
slow one: the Azure mirror serving `test`'s ~23 MB of valgrind, libc6-dbg and
wasi packages at a trickle ran the install step into its five minutes on one
shard of most main runs in October 2026. So every Ubuntu install goes through
`.github/actions/apt-install`. It runs `.github/apt-mirror.sh` first, which
points apt at a mirror list of our own (mirrors.edge.kernel.org, then
archive.ubuntu.com, then security.ubuntu.com) in place of the Azure mirror,
and apt moves down the list when a mirror fails. It keeps the `.deb`s in the
Actions cache, keyed by package list, runner image and architecture, so a job
normally downloads nothing, and on a miss it cuts each download attempt at a
minute and retries twice. Every Homebrew install goes through
`.github/actions/brew-install`, which keeps the bottles in the cache the same
way.

Three jobs took longer than 15 minutes unsplit, so each is split:

- **`test`**, nine ways. `node tests/run.js --shard <i>/<n>` splits the suite.
  Every shard builds stage1 and runs everything before the `tests/link/`
  programs but the sections there that are dealt (`term-io`, `--emit-ts`
  and the fifteen small sections between the golden cases and the link
  programs, from `os_host` to `tests/fix`): the setup and stage1 per shard
  (measured in the paragraph on the eight-way split, below, from before the
  small sections were dealt). The golden cases are dealt whole: `caseShard` in `tests/run.js` deals them round-robin within
  each kind (rejections, stdout programs, linked, compiled), and a shard
  compiles, checks the IR of, assembles and runs only its own, printing each
  other case as delegated to the shard that owns it. A later section that
  reads a case's IR takes the path from `caseLl`, which compiles a case this
  shard does not own on demand, so a section reads the same `.ll` whichever
  shard runs it; a check fails on any reader that names a case's `.ll` by
  hand instead. The two linked specimens, with and without `--threads`, stay
  on shard 1. Shard 1 runs every section after them
  that is not dealt, together with the link programs whose output a later
  check reads (`LINK_READ_LATER`). The dealt sections (`DEALT_SECTIONS` in
  `tests/run.js`: term-io, `--emit-ts`, the small pre-link sections (`os_host`,
  `nish:term` and its wasi build, the `net_` and TLS socket sections, the
  `file_` wasi builds, fnref, diagnostics, performance, `mem_awfy` and
  `tests/fix`), WP14 self-hosting, crypto-bench, the
  sanitizer and fuzz replays, the Nish runner's `pop` run, WP9 bench, the
  runtime cache, SQLite linking, the WP13 differential, and eleven `tail`
  groups of the sections after the link programs) and the remaining link
  programs are dealt by cost: `tests/shard-costs.json` holds the seconds
  each took in a CI shard, and `linkShard` in `tests/run.js` gives each,
  largest first, to the shard with the least so far, shard 1 starting from its
  own sections' cost. A link program costs at least half a second (a rejection
  a twentieth), whatever the table says or whether it names the program at
  all. The deal is deterministic, so every shard computes the same one. Every
  shard but 1 stops once its share is done. What a shard leaves to another is
  counted as **delegated** and names the shard that proves it, so no shard's
  summary claims checks it did not make. A dealt section works in a directory
  of its own and reads nothing another section writes, since the shard that
  runs it runs none of the others it used to run beside.

  On a pull request, crypto-bench's timing leaves the shard
  (`--delegate-bench-timing`, honoured on a `pull_request` event only). The
  section still builds every twin, checks every checksum against
  `bench/crypto/expected.txt` and asserts which kernel path ran; the timed
  portability proofs (`bench/crypto/run.mjs` without `--no-proofs`, and the
  paired portable-rounds runs) print as `DELEGATED` to the push-to-main run
  of the same `test` job. A newer push to `main` cancels an older one's
  first attempt (`concurrency` in `ci.yml`), so the proofs time the code as
  it stands at the next push whose run is not cancelled. A check in
  `tests/run.js` fails if `ci.yml`'s `test` job stops running on a push to
  `main`. The builds are most of the section (about 184 s of 273 s locally);
  the timed proofs are the paired runs (49 s and 30 s) and the portable
  proofs. WP9 bench stays whole on every push: its checks are all asserts.

  Regenerate the table when a shard drifts more than about a fifth from the
  others, with `scripts/shard-costs.mjs` over at least three green `ci.yml`
  runs of `main` (each unzipped from its run page's "Download log archive"):
  `node scripts/shard-costs.mjs --write <dir> <dir> <dir>` takes each piece's
  median, so one slow runner does not set it, and fails rather than guess at
  a section it cannot find by its first check (`RECOGNIZERS`, one per
  `DEALT_SECTIONS` key) or a shard whose link programs do not number what
  shard 1 says it dealt it. It reads the same spans this paragraph names: the
  costs are the gaps between consecutive programs' last lines in a
  CI shard's log, `shardOne` the span of shard 1's sections after the link
  programs that are not dealt, plus its steps after the suite (less the
  smoke, cookbook and size-report steps, which a log from before the
  `examples` job still holds: `MOVED_STEPS`), and each dealt
  section's entry the span of its lines in the shard that ran it. Runners
  differ in speed by nearly a factor of two (one built stage1 in 34 s where
  its siblings took 57-61 s), so read a span only from a shard whose stage1
  build and pre-link sections took as long as the other shards': a shard on a
  fast runner finishes early on any table. The link programs run
  `defaultJobs()` at a time and print in order, each once it and every program
  before it are done, so a gap is a program's share of its shard's pooled wall
  clock rather than its own run time: one that finished behind a slower
  predecessor reads near 0, which is why the deal puts a floor under it. A
  shard's gaps still add up to its link wall clock, which is what the deal
  balances.

  The table is measured from
  [run 40820090678](https://github.com/amritk/nish/actions/runs/40820090678)
  (`b290fe2`). On the table before it, its `test` shards took 20.0, 14.8, 11.6
  and 7.8 minutes. Two things made shard 1 the longest by six minutes. Every
  shard ran `term-io` (56 s) and the `--emit-ts` corpus (110 s) before its link
  programs, so each spent about five minutes there rather than two. And shard
  1's own sections had grown from 475 s to 791 s, a floor no deal moved; six
  of them, 344 s together, now are dealt instead (`sanitizers` 80 s,
  `nishRunner` 31 s, `bench` 84 s, `runtimeCache` 36 s, `sqliteLink` 66 s,
  `differential` 48 s), which leaves `shardOne` at 484 s. Shards 2-4 were
  uneven for a third reason: 632 of the 806 link programs read 0 in the old
  table or were not in it, every one of them was dealt to shard 2 (634
  programs, against 69 and 79), and those that link cost about half a second
  each there. Dealt again on the regenerated table, with the floor, every
  shard carries 570 s after its pre-link sections.

  That left shard 1 the longest by six to ten minutes again as its own
  sections grew: in
  [run 41882940444](https://github.com/amritk/nish/actions/runs/41882940444)
  (`46f3dad`) its job took 20.6 minutes against 14.4, 11.6 and 14.3, twelve
  of them the 706 s of sections after the link programs. Eleven blocks of
  those sections, 550 s together, moved whole to before the point where the
  other shards stop, each with every name it declares and every directory it
  writes, and are dealt as `tail` groups; `shardOne` is the 156 s left plus
  shard 1's 62 s of steps after the suite, 218 s. The link costs and the
  groups' costs are read from that run's four logs. With 946 link programs
  now, the job is split eight ways: about 390 s of the table each, after
  about 200 s of setup, stage1 and pre-link sections that every shard ran
  then (job start to its first link program in three shards of `main`'s runs
  at `2d10118`, `ea8b601` and `2f4f8e3`: 152 to 223 s, of which 28 to 45 s
  are the steps before Test; a shard dealt a slow pre-link section, as
  shard 5 at `ea8b601` was, takes longer). That was before the golden cases
  and the small pre-link sections were dealt, at the end of this section.
  A filtered run sends every `tail` group to shard 1, as it sent all of
  that, and counts none of them in its deal.

  Hand-written from one run, that table drifted until shard 8 was the
  longest job of every run: in
  [run 43116599932](https://github.com/amritk/nish/actions/runs/43116599932)
  its four sections took 333 s against the 221 s the table gave them
  (`sanitizers` alone 152 s against 80 s), and the shards took 7.2 to 12.5
  minutes. `scripts/shard-costs.mjs` regenerated it from the median of that
  run and runs 43109728024 and 43114281714; dealt on it, the old deal's
  pieces measure 5.0 to 8.4 minutes a shard after the setup every shard
  runs, and the new deal's 6.5 minutes each.

  With the smoke, cookbook and size-report steps moved to the `examples`
  job and shard 1's sections dealt as `tail` groups (#1797), shard 1 was no
  longer the long pole, but the interim table mis-dealt the rest: in
  [run 44569577732](https://github.com/amritk/nish/actions/runs/44569577732)
  (`4614df6`) the shards reached their summaries at 8.2, 10.8, 12.0, 7.2,
  7.2, 8.2, 9.9 and 8.0 minutes, 12.5 minutes wall. The table was refitted
  from the median of that run, run 44565722776 and `main`'s run
  44489604733. Dealt on it eight ways, each shard carries about 511 s of the
  Test step after its 40 s of setup, about 9.2 minutes a job, above the
  8.5 minutes that leaves room under ten for a slow runner; nine ways it
  carries about 454 s, about 8.3 minutes. So the job is split nine ways.
  One deal runs from 542 to 684 s on the same shard across runs, so a
  single run's slowest shard says more about its runner than about the
  table.

  The first nine-way run,
  [run 44573014763](https://github.com/amritk/nish/actions/runs/44573014763)
  (`8334dc9`), was dealt 453 s a shard but took 336 to 600 s, 11.7 minutes
  wall. Its own measure of each piece, summed over that deal, gives 358 to
  600 s, so the script reads the log right and the eight-way runs had
  costed the pieces differently. The script also mistook shard 9's golden
  case `arr_range_call_generic` for the `arrayChecks` section, and now looks
  for sections only after the golden cases. The table is refitted from the
  median of that run and runs 44569577732 and 44565722776. Its deal comes to
  455 s a shard, and summed under each of those three runs' own costs its
  slowest shard is 1.07 to 1.18 times its median one. The test shards need
  no other job, but a run's 26 jobs queue for runners, and in that run
  shard 5 started 1.6 minutes after the first.

  Dealt on that table,
  [run 44576694180](https://github.com/amritk/nish/actions/runs/44576694180)
  (`2df949d`) took 9.1 minutes wall, its test jobs 355 to 537 s, the
  slowest 1.14 times the median. The table was refitted again from the
  median of the two nine-way runs and run 44569577732.

  By November the table had drifted again: in
  [run 44844198696](https://github.com/amritk/nish/actions/runs/44844198696)
  (`29b227f`) the shards reached their summaries at 5.5 to 11.2 minutes, and
  shard 6 took 9.9 to 12.2 minutes in each of the six runs sampled. The
  table gave `cryptoBench` 143 s where the median run measures 282 s,
  `cliChecks` 137 s against 218 s, and shard 1's own stretch 137 s against
  185 s. The script had also stopped reading shard 1: its `netStartup`
  recognizer matched any `net_` check, and the `net_tcp_connect` checks that
  now print before the link programs ended them before they began. It now
  matches that section's own first check. The table is refitted from the
  median of `main`'s runs 44854582983, 44844198696, 44827024001 and
  44822891907; runs 44846716586 and 44839975519 were left out because their
  shard 8 log ends before its summary. Summed under the new median costs,
  the old deal's shards carry 6.4 to 9.4 minutes of the Test step and the
  new deal's 8.1 minutes each. Twelve ways the same table deals 6.1 minutes
  a shard, but each of the three added jobs repeats the setup and the
  compiler build, so the job stays nine ways.

  The table was refitted again from `main`'s runs 45857452100, 45751157072
  and 45742983720, whose slowest shards reached their summaries at 13.4,
  14.0 and 12.5 minutes. The 151 `link` programs added since the last refit
  had no cost and were dealt at their floor, and the `stdPanics` section at
  the 1 s a missing section is given; it had no recognizer either, so
  `scripts/shard-costs.mjs` stopped with "DEALT_SECTIONS.stdPanics has no
  recognizer" until one was added. The
  same shard took 8.4 to 14 minutes across those runs, so a refit's gain is
  read off later runs, not predicted.

  The steps after the suite that require a `PASS` line or a driver the suite
  built (`cpu-level`, `hardening`, `sandbox`) grep the Test step's log for it
  rather than running their section again, so those sections stay in shard
  1. The `simd` group's seven steps (the AVX2, AES-NI, SHA-NI, ChaCha20,
  CRC-32 and SSSE3 Adler-32 paths, the lowered AES kernels) run in shard 2,
  where `DEALT_SECTIONS.simd.pinned` keeps that group; a check in
  `tests/run.js` holds their `if:` to it. The group measured 173 s when it
  had eight: the eighth, SHA-256 throughput, printed figures and asserted
  only that the driver printed something, which the `simd` section's
  `sha256-calls` check already holds, so it was removed; `simd-arm64` and
  `sha256-macos` keep their platforms' figures.
- **`runner`**, three ways, and one process per core in each.
  `build/nish-runner --shard <i>/<n>` starts itself `--jobs` times (the core
  count up to 8 by default) as `--shard <i>/<n> --part <k>/<p>`, so job `i`
  runs exactly the programs `--shard <i>/<n>` names. Cases are dealt
  round-robin by position; link programs, most of the time, are dealt by
  their `link` cost in `tests/shard-costs.json`, dearest first to the
  lightest piece, first among the shards and then among a shard's parts. By
  position, shard 3 drew `net_handler`, `crypto_p384` and
  `std_postgres_carrier` (about 50 s each) and was the longest of every run:
  351, 398 and 504 s of link programs on the table's costs, the median of
  the three runs above, against 417.9 s each dealt by cost. The CI step runs
  `node scripts/shard-costs.mjs --check-runner build/nish-runner 3 $(nproc)`
  before the corpus: it reads the deal through the runner's `--list`, which
  prints what the flags would run, and fails when a piece misses or repeats
  a program or carries more than its siblings' mean plus the dearest
  program. Each process keeps its
  work under `build/nish-runner-jobs/<slice>-of-<total>/`; `build/test`,
  which cases write into by literal path, is shared, and `io_nish_import` and
  `io_nish_import_global`, which write the same file there by design, are
  dealt one position so one process runs both. One runner at a time left
  three of a runner's four cores idle: in run 40820090678 the four jobs took
  13.1, 13.0, 8.8 and 8.3 minutes, and the split was even -- 212 cases each,
  290 s of them on shards 1 and 2 and 160 s on 3 and 4, which were faster
  machines. Two ways of four processes, the corpus took 8.1 minutes on one
  job and passed the 15-minute limit on the other in run 40997535378: the
  four slices of each job finished within seconds of one another, so the
  split was even again and the machines were not. Every `tests/link` program
  then linked at -O3 with LTO, about 20 of `net_loopback`'s 26 s; the runner
  now links them under the profile `tests/run.js` gives them
  (`tests/speed-link.txt`), and the corpus is dealt three ways.
- **`runtime-net`**, three ways. `node tests/run.js net_ --shard <i>/3` is a
  filtered run, which deals only the link programs its filter selects and
  starts shard 1 at nothing, so each mac shard gets about a third of the 188
  `net_` programs. Unsplit they took from 11 to over 28 minutes on one runner
  image, and a run past 30 was cancelled. Three, because an account runs at
  most five macOS jobs at once and the `bootstrap` darwin rows are two.

A check in `tests/run.js` holds each job's `shard:` list to the `n` its
`--shard` names. A list shorter than `n` would be a green run in which one
shard's programs ran nowhere.

### The macOS `test` row

`npm test` on `macos-latest` was run on 2026-09-13 (five failures) and on
2026-09-21 (`2125 passed, 6 failed, 4 skipped`,
[run 606](https://github.com/amritk/nish/actions/runs/35652075129)). None of
the failures is a compiler bug: each check read an ELF fact out of a linked
binary instead of the property it tests. Three were ported (`lineTableOf` in
`tests/run.js` reads the `.dSYM` the Darwin driver writes; the `--threads`
runtime mismatch is caught as a segfault on Darwin rather than as a link
error). The two `runtime objects:` byte comparisons were the next two: they
linked their two binaries at different output paths, and `LC_UUID` (next
section) varies with the path. They now link at one path and move each binary
aside, and the `runtime-net` job measures the default runtime's green on
a mac (#358). The four that still hold the row out, listed with the run in the
comment beside `os:` in `ci.yml`, are three causes and one simulation:

- the `--threads` mismatch again, in the prebuilt runtime-object gate;
- the Mach-O debug map, read through `.debug_info` in the self-hosting `-g`
  check;
- `LC_UUID` in `tests/self/bootstrap.js`'s `stage3 == stage2`, which links its
  two stages at different output paths;
- plus one check that simulates Darwin from Linux through `NISH_UNAME_S` and
  has nothing to report on a real mac.

The macOS row also skips two more checks than Linux (the runtime `.text`
budgets are measured on `linux-x64`; `verify-binaries`'s debug-map arms need a
toolchain this one is not). Restoring the row is the one commented line plus
those four ports; the macOS LLVM install step is already written and guarded by
`runner.os`. Two bash 3.2 defects that used to stop the row first — empty
arrays under `set -u` in `scripts/build.sh`, and `mapfile` in
`scripts/smoke.sh` — are fixed.

#### What ld64 varies, measured

A throwaway workflow ran `release.yml`'s `binaries` steps on both darwin rows
on 2026-09-19 and attributed every byte by which stage3 and stage2 differed:

| Row | Runner | Size, both | Differing | Where |
| --- | --- | --- | --- | --- |
| `x86_64-darwin` | `macos-15-intel` | 649,808 | 16 bytes | `0x468`–`0x478`: `LC_UUID`, and nothing else |
| `aarch64-darwin` | `macos-latest` | 646,696 | 48 bytes | the same sixteen, plus 33 in the `LC_CODE_SIGNATURE` blob: the page hash of the page `LC_UUID` sits on, because ld64 ad-hoc signs arm64 |

`-Wl,-no_uuid` makes the binaries identical but is not available: dyld on
arm64 refuses an image with no `LC_UUID` (`missing LC_UUID load command`,
then `Abort trap: 6`). A further probe found the UUID stable across two links
to one output path and different on a link to another. The output path is the
leading explanation, not a finding — the probe's same-path links also ran
first, so path and invocation order are confounded, and the fourth link that
would separate them was not run. The remedy holds either way:
`scripts/bootstrap.sh` links stage2 and stage3 at one path and moves each into
place, `stage3 == stage2` is still a raw `cmp`, and both darwin rows came out
byte-identical end to end:

| Run | `aarch64-linux` | `aarch64-darwin` | `x86_64-darwin` |
| --- | --- | --- | --- |
| [1, as things stood](https://github.com/amritk/nish/actions/runs/35431909673) | green | red, *unattributed* | red, *unattributed* |
| [2, `-Wl,-no_uuid`](https://github.com/amritk/nish/actions/runs/35432446491) | green | red in dyld | green |
| [3, the UUID probe](https://github.com/amritk/nish/actions/runs/35432749109) | green | red, *unattributed* | red, *unattributed* |
| [4, one link path](https://github.com/amritk/nish/actions/runs/35433181271) | green | **green** | **green** |

The Darwin narrowing in `scripts/verify-binaries.sh` stays as a net under a
comparison that now holds, and `tests/run.js` pins its `LC_UUID` case as a
known limitation of that script. `scripts/verify-binaries.sh`'s header carries
the offsets.

### The release reuses the Release PR's run

`release-pr.yml` dispatches `ci.yml` at `release/next`, and that run selects
the same jobs a tag's run does: every lane (it is not a `pull_request`), the
`runner` job, and the gate's expectations, which read only whether the ref
is the tag or `release/next`. Merging the Release PR then cuts the tag, and
`release.yml` used to run the whole of `ci.yml` again on it before building
anything. Its `verdict` job now runs `scripts/ci-verdict.mjs` first, with a
token that adds `actions: read` to `contents: read`. The script takes the newest
twenty green runs of `ci.yml` dispatched on `release/next` and names the
newest one whose commit has the tag commit's git tree. A squash merge makes
a new commit, but its tree is the Release PR head's tree whenever
`release/next` was up to date with `main`, so the bytes tested are the bytes
released. When `main` moved after the last dispatch, no tree matches and
the `ci` job runs as before. The rule fails closed: a run of any other
event, branch, repository or workflow, or not completed with `success`, is
passed over, and any API error names no run, so `ci` runs.

`release` needs `ci` to have passed, or to have been skipped because
`verdict` succeeded and named a run. `binaries` no longer waits for `ci`:
it needs only `targets`, so the four platforms build while CI runs, and
`release`, which publishes, still waits for both. `node tests/run.js
release.yml` pins all of it: the eligibility rule against each kind of run
it refuses, the newest-matching pick, that `verdict` alone is given
`actions: read`, and each job's `needs` and `if`.

### The seeded build, and what a missing seed reports

`bootstrap` builds `src/` with the **last released** binary, the only compiler
that exists to build it with, and so is the only check of the rolling freeze
([wp12-release.md](wp12-release.md#the-bootstrap-seed)). There are three
answers and two colours, so it is a pair of jobs: `seeds` answers in seconds,
before any toolchain, and `bootstrap` is a matrix over that answer, one row per
seed the release actually carries.

| The checks list says | It means |
| --- | --- |
| `seeds` green, a `bootstrap (<seed>)` row green | the freeze was checked with that seed on its own platform, and held |
| `seeds` green, no row for a platform | the freeze was *not* checked there, and nothing is wrong: no release carries that seed yet. The `seeds` summary names every platform in both states |
| `seeds` green, `bootstrap` **skipped** | there is no release at all |
| `seeds` **red** | a release is missing a seed it was due to attach |
| a `bootstrap` row **red** | `src/` does not build with the last release: the rolling freeze broken |

The gate has been wrong both ways. It first warned and exited 0 when it had
checked nothing; then it went red for every missing seed, which deadlocks a
repository with no release (the 0.1.0 base case, and every fresh fork),
because `release.yml`'s `release` job is `needs: ci`. Which missing seed is red
is now data: `.github/seed-targets.json` gives each platform its triple, its
asset name, its runner, and `attachedSince`, the first version that carries
it, and `.github/seed-due.sh` is the one place that compares versions. The
targets are attached from these releases: `x86_64-linux` from 0.1.1 and the
other three from 0.4.0. A platform not yet due has no row and is listed as
unchecked.

`.github/seed-matrix.sh` is a file rather than inline shell so that
`tests/run.js` can drive it against a stand-in for `gh` through every state;
inline shell nothing could run is how the logic was got wrong twice. The same
block checks each row's `triple` against `src/target.ts` and that each `asset`
is the triple with vendor and ABI dropped.

G3 is checked on both operating systems: the darwin pair's `attachedSince` is
0.4.0, so `bootstrap (aarch64-darwin)` and `bootstrap (x86_64-darwin)` have
run since that release. Because *presence* of an asset, not `attachedSince`,
creates a row, a platform's rows are exercised once before its version
arrives — a red row there would be red CI repo-wide, and only deleting the
published asset clears it. `release.yml` cannot be dispatched at a branch, so
that is done with a throwaway branch workflow running the `binaries` steps
without uploading; it needs a `push:` trigger, since `workflow_dispatch` needs
`actions: write`. The note under BEFORE ADDING A PLATFORM in
`seed-targets.json` has the recipe, and the four runs above are its record.

### The parity run, retired

`parity.yml` ran the whole corpus nightly through both compilers under sixteen
flag variations, and `parity-select` / `parity-changed` did the same per pull
request; it was WP19 G1's corpus half. All three compared stage0 with stage1
and went with stage0's `src/` in R6. The corpus is held now to its goldens
(`tests/cases/*.ll`, `.err`, `.stdout`) and to `nish-cmp`, which compares HEAD
with the last release.

### The toolchain on each runner

`tests/run.js` and the scripts probe for the plain names `clang`, `llc`,
`llvm-as`, `opt`, `ld.lld` and `wasm-ld`. Ubuntu symlinks Debian's versioned
binaries into `$RUNNER_TEMP/llvm-bin` ahead of `/usr/bin`; macOS prepends
`$(brew --prefix llvm@18)/bin` and installs the standalone `lld` formula only
if `llvm@18` ever stops bundling `wasm-ld`. The `Test` step sets
`WASI_SYSROOT=/usr`, because Debian's wasi-libc lives under
`/usr/lib/wasm32-wasi`; with it the wasi checks run instead of being counted as
skips, and a sysroot that is found and cannot link is a failure (the guard
that #396 lacked). `node tests/run.js wasi` runs those checks alone.
`NODE_COMPILE_CACHE` is set for every job; it can only save Node start-up time,
never change an answer.

## Where the wall clock goes

The last full measurement predates R6 (run 474 on `main`, `a89bee7`,
2026-09-18): `batch-parity` 18 m 21 s, `test` 15 m 42 s (`npm test` 14 m 44 s),
`runner` 6 m 08 s, `bootstrap` 1 m 11 s, `lint` 10 s, `seeds` 8 s. Most of
`test` then was comparisons with stage0, each paying about 634 ms of Node and
`typescript` start-up per spawned compiler for 1.5 ms of compiling; R6 removed
both the comparisons and that cost. These numbers describe that tree, not this
one, and want re-measuring before anyone cites them. The five costliest checks
of that run were:

| Check (`a89bee7`, local run of 660.5 s) | Cost |
| --- | --- |
| `src/emit.ts emits the IR stage0 emits` | 90.1 s |
| `codes: every registry code is provoked by a program or explained` | 80.0 s |
| `src/checker.ts agrees with stage0 on what it accepts` | 70.5 s |
| `differential` | 51.1 s |
| `src/ compiles src/: the bootstrap reaches a fixed point` | 46.1 s |

`scripts/ci-profile.mjs` produced that table. It spawns a suite command,
timestamps each output line and attributes every gap to the check that closed
it:

```bash
node scripts/ci-profile.mjs                    # node tests/run.js
node scripts/ci-profile.mjs --top 60 --json    # machine-readable
node scripts/ci-profile.mjs -- npm run test:nish
```

Profile the **unfiltered** run: `node tests/run.js <substring>` measures
nothing until `rm -rf build/test`, and `fs.existsSync` guards drop checks with
no `SKIP` line (`.claude/testing.md`). A shard is not a filter, which is why
`--shard` cuts at a section boundary and delegates rather than filtering
([shards](#shards-and-time-limits)).

A newer measurement, per section rather than per check, on `e1449d5` (an
unsharded local run, before the link pool and the eight-way split described
under [Shards](#shards-and-time-limits)): one
unsharded local run of 2014 s spent 1305 s on the `tests/link/` programs, 344 s
on WP14 self-hosting (its fixed point included, which CI delegates), 96 s on the
WP13 differential and 56 s building stage1. Every other section took under
35 s, and they came to 213 s together. CI's `test` step took 24 min 29 s on the
same commit. That is why the link programs were the first thing dealt out, and WP14 the
one section then large enough to deal with them.

The link programs have since moved to a worker pool (`defaultJobs()`, four on a
hosted runner), so in a shard they are no longer most of the time. These
figures are from the four-shard era, before the split into eight. In
[run 40093958447](https://github.com/amritk/nish/actions/runs/40093958447),
with #909's cheaper link profile as well, the 719 programs took 431 s of wall
clock across the four `test` shards, 16 to 254 s per shard, against 123-192 s
per shard for the sections before them and 39-55 s for stage1. The largest
single spans were shard 1's sections after the link programs (475 s, with 21 s
of steps after the suite), crypto-bench (268 s, shard 2) and WP14
self-hosting (137 s, shard 3). The longest `test` job took 11 min 59 s, on
shard 1.

Six weeks later, still on four shards, in
[run 40820090678](https://github.com/amritk/nish/actions/runs/40820090678),
the longest `test` job took 20 min 0 s, again shard 1: 5.6 minutes before the
link programs, which every shard repeated, and 13.2 after them, which shard 1
alone ran. [Shards](#shards-and-time-limits) says what moved where. The
`runner` job was the next longest at 13 min 6 s, on one core of four.

On eight shards, in
[run 43369900293](https://github.com/amritk/nish/actions/runs/43369900293)
(`ac813b5`), the run took 11 min 31 s and the longest `test` job was shard 2's
at 11 min 29 s. Each shard's Test step spent 43-75 s linking stage1, 109-249 s
on the sections before the link programs (59 s of shard 2's in section A, the
golden cases, which every shard ran in full) and 185-395 s after them. The stage1 link is the
seed's front end (2 s) and then the speed profile's full LTO on one core (about
69 s): a target with landing pads links in one partition. The NEON job, the
second longest at 10 min 45 s, linked stage1 seven times, once per
`node tests/run.js` step. Since then `tests/self/compiler-cache.js` keeps the
linked binary under a hash of everything the link reads, and the
`.github/actions/compiler-cache` step restores it through the Actions cache:
a run whose compiler sources (the modules the seed's front end names: `src/`
and the nine `std/` modules it imports), seed and toolchain match an earlier
one copies stage1 instead of linking it, and a job that runs the suite more than once
links it at most once. A shard that still spends 70-80 s on the step is a
miss, not a broken cache:
[run 44241824047](https://github.com/amritk/nish/actions/runs/44241824047),
a push to `main` whose `src/` change made a new key, linked and saved on
every row (63-83 s a test shard), and
[run 44243579767](https://github.com/amritk/nish/actions/runs/44243579767),
the next push, which changed tests only, restored it in 4-6 s a shard. In
the first, `fuzz-smoke` and `postgres-live` spent 96 s and 113 s on
`npm run build`, which links stage1 and then stage2 from it; they now take
the `test` job's stage1 through the same action under the same key (stage2
is the same compiler, which `bootstrap (x86_64-linux)` asserts), and
`nish-cmp elision`'s candidate, the same `--link` with its row's seed, comes
through it too. Dealing the golden cases' work after the compile
(each shard still compiled all of them then) took section A from 59 s to
30 s of shard 2 in
[run 43375907084](https://github.com/amritk/nish/actions/runs/43375907084),
where every job restored stage1 from the cache; a shard now compiles and
checks only its own eighth too, as [Shards](#shards-and-time-limits) says. The longest `test` job there
took 10 min 49 s and the NEON job 4 min 38 s. What every shard still ran
before the link programs then was about 90 s of small sections, the largest
`fnref`'s `--profile debug` runs and lldb check (15 s), the performance
section (14 s), the diagnostics section (14 s) and `--fix` (10 s). Those
fifteen sections are now dealt as well (`osHost` to `fix` in
`DEALT_SECTIONS`), so a shard runs only its share of them. Their costs in
`tests/shard-costs.json` are per-section maxima from that run: for each, the
largest span from its first check to its last that one of shards 1 to 4 paid.
In [run 43402907927](https://github.com/amritk/nish/actions/runs/43402907927),
the first with that deal, the span from the native run limit to the first link
program fell from 65–219 s a shard (825 s summed) to 7–121 s (272 s summed).
What remains on shards 6 and 8 is `emitTs` and `termIo` with the `nish break`
check, dealt before. The longest `test` job went from 10 min 49 s to
8 min 32 s.

## Running the same steps locally

```bash
# Ubuntu / Debian
sudo apt-get install -y clang-18 lld-18 llvm-18
mkdir -p ~/.local/llvm-bin
for t in clang clang++ llc llvm-as opt ld.lld wasm-ld; do ln -sf /usr/bin/$t-18 ~/.local/llvm-bin/$t; done
export PATH=~/.local/llvm-bin:$PATH

# macOS
brew install llvm@18
export PATH="$(brew --prefix llvm@18)/bin:$PATH"

npm ci
bash scripts/fetch-seed.sh   # the last release's nish into build/seed/ (or set NISH_BOOTSTRAP)
npm run check           # tsc over src/, std/ and tests/nish/, emitting nothing
npm run build           # the seeded bootstrap: build/nish
npm test                # stage1 from the seed + tests/run.js
npm run lint
npm run size-report

# the wasi checks, as CI runs them (Ubuntu / Debian)
sudo apt-get install -y wasi-libc libclang-rt-18-dev-wasm32
WASI_SYSROOT=/usr node tests/run.js wasi
```

`npm run test:update` writes a missing case golden but not the per-module
goldens of `tests/link/` programs; `node tests/run.js <name>
--update-link-goldens` rewrites those (all of them without `<name>`). Read
the diff before committing any regenerated golden.

`scripts/build.sh` and `scripts/size-report.sh` branch on `uname`: on macOS
they use ld64's `-dead_strip` / `-x` instead of `--gc-sections` / `-s` and skip
`-fuse-ld=lld` and `-fno-plt`. The `wasm` profile finds the linker with
`clang -print-prog-name=wasm-ld`; with no `wasm-ld` the size report omits the
row and `build.sh --profile wasm` exits 2.

## Diagnostic format

Every error is a `Diagnostic` (`src/diagnostics.ts`), printed to stderr as:

```
tests/cases/reject_type_mismatch.ts:1:40: error: Operator `+` requires two operands of the same numeric type, got i32 and boolean
  1 | function f(a: number): number { return a + true; }
    |                                        ^~~~~~~~
```

- Line 1 is `<file>:<line>:<col>: error: <message>`, 1-based, at the start of
  the offending node. Tests match substrings of this line.
- Line 2 is the source line, prefixed with its number and ` | `.
- Line 3 puts `^` under the start column and `~` to the end of the node on
  that line; tabs are reproduced so the markers stay aligned.

Parser errors use the same layout with `syntax error:` in place of `error:`.
A tool that wants the parts reads `--json` instead of parsing this text. The
format's tests are the `// ---- WP10: diagnostics` block of `tests/run.js`.

## Multi-error reporting

Every phase that can recover reports into one `DiagnosticSink` owned by the
`Compilation` (`src/compilation.ts`):

| Phase | Recovery unit | Where |
| --- | --- | --- |
| Parser | every parse diagnostic of the file | `parse` (`src/parser.ts`) |
| Phase 0 validator | every forbidden construct (a rejected node's subtree is skipped) | `validate` (`src/validator.ts`) |
| Pass 1 (signatures) | per declaration; a broken class is marked `poisoned` | `Checker.collectSignatures`, `Compilation.load` |
| Pass 1b/1c | per import binding; every symbol clash | `Checker.bindImports`, `Compilation.rejectSymbolClashes` |
| Pass 2 (bodies) | per statement; the enclosing function is `poisoned` | `checkStatements` (`src/statements.ts`) |

The language has no exceptions, so a phase returns a sentinel and the sink is
asked at the end of the phase whether to stop: pass 2 never runs over broken
signatures and the emitter never sees a poisoned function. `sorted()` orders
the errors by file load order, then line and column, stably. The driver prints
at most 20 (`MAX_REPORTED_ERRORS`), then `...and N more errors`, then
`N errors`; a lone error prints exactly its message. `let x: T = <rejected>`
still declares `x` as `T`, and unreachable code is reported once per statement
list, to limit cascades. Tests: `tests/cases/reject_multi_*`.

## `--json`

`nish --json file.ts` prints one JSON object per diagnostic on stdout, nothing
on stderr, with the same exit code:

```
{"file":"tests/cases/reject_multi_error.ts","line":2,"column":10,"endLine":2,"endColumn":18,"severity":"error","code":"NL2231","message":"Operator `+` requires two operands of the same numeric type or two strings, got i32 and boolean"}
```

`line`/`column` are 1-based, `endLine`/`endColumn` exclusive. `severity` is
`"error"`, `"performance"` (WP15 §8), `"portability"` (WP33,
`--warn-portability`) or `"deprecation"`. Syntax errors keep the
`syntax error: ` prefix in `message`.

### `code`

`code` is the stable identifier of the broken rule and the field to key on:
`message` may improve between releases, the code may not. The registry is
`src/codes.ts`, **kept by hand**: a new diagnostic takes the next free number
in its band (`node scripts/gen-diagnostic-codes.mjs` with no flag prints
them), a number is never moved or reused, and a retired rule keeps its entry so
its number stays reserved. `--check`, run by `npm test` and by CI, validates
the format, the bands, the longest-fragment-first order, the pairing, that the
`NL7xxx`, `NL8xxx` and `NL9xxx` runs have no gaps, and that every code is
unique. The script generated the registry from stage0's sources until R6 and
is frozen now. `tests/diagnostic-coverage.js` requires every code to be
provoked by a program in `tests/wordings/` or explained in
`tests/wordings/unreachable.txt`.

The band says which phase refused the program:

| Band | Meaning |
| --- | --- |
| `NL0000` | no rule matched this message |
| `NL0001` | a syntax error; every one shares this code |
| `NL0002` | the C toolchain `--link` needs, or the prebuilt compiler itself, could not be run (exit 3) |
| `NL0003` | an internal compiler error (exit 70) |
| `NL1xxx` | Phase 0, the forbidden-syntax sweep (`src/validator.ts`) |
| `NL2xxx` | the checker: signatures, bodies, types |
| `NL3xxx` | the driver and module loading |
| `NL4xxx` | the interop sidecar generators |
| `NL7xxx` | a deprecation warning: a call that still compiles and that a later breaking release removes ([LANGUAGE.md](LANGUAGE.md#diagnostics-and-debugging-flags)) |
| `NL8xxx` | a WP33 portability warning, under `--warn-portability` ([wp33-round-trip.md](wp33-round-trip.md) §5.2) |
| `NL9xxx` | a WP15 §8 performance warning |

A code is matched against the longest literal run of the message's template,
with interpolated names, types and counts removed. A message built entirely of
interpolations has no such run and reports `NL0000`; `tests/run.js` pins that
backlog (`UNCODED_BACKLOG`, zero today) so it can shrink but not grow. Codes
appear in `--json` only: the human summary line is byte-for-byte what the
`.err` goldens match.

### Failures without a source position

Every failure is a parseable line under `--json`, so a wrapper is never left
with an empty stdout:

```
{"severity":"error","code":"NL0002","message":"--link: no usable C compiler found (...)"}
{"severity":"error","code":"NL0003","message":"internal compiler error while compiling a.ts: ..."}
```

A driver error (a bad `-o` layout, an unreadable input) has the same shape and
takes whatever code its text resolves to. An internal error is also reported
on stderr, because a crash is worth seeing twice.

## Performance warnings in CI

A performance warning never changes the exit code, so the gate is checks in
`tests/run.js` rather than a flag or a workflow step:

| What | Held to | Read from |
| --- | --- | --- |
| every `std/*.ts`, `examples/*.ts` and `examples/*/main.ts`, discovered from the directory | **zero** performance warnings, in both number modes where the program compiles | `--json`, `severity` `"performance"` (`NL9xxx`) |
| the same programs | **zero** deprecation warnings | `--json`, `severity` `"deprecation"` (`NL7xxx`) |
| the compiler, `src/` | `tests/perf-baseline.json`, per file and per code | the `--json` of the self-hosting compile |

The baseline only moves down. A count above it fails and prints the warnings;
a count below it fails with the line to edit (`set it to N in
tests/perf-baseline.json`), which is made in the same change, deleting an
entry that reaches zero. `.claude/testing.md`, "The performance gate", has the
rest.

## `--emit-ast` and `--emit-checked`

Both write to stdout instead of IR (`src/ast-text.ts`, `src/dump.ts`), with
file names relative to the working directory.

- `--emit-ast`: the tree of every module after Phase 0, one node per line,
  `<SyntaxKind> <line:col>-<line:col>` (end exclusive) plus identifier and
  literal text.
- `--emit-checked`: after every checker pass and the attribute analysis,
  per module: `struct` lines (layout, fields with index and byte offset),
  `import` lines, and `function` lines (signature, `@symbol`, flags), each with
  its `facts:`, `pointer <param>:` facts and `local` / `callee` lines.
  `tests/self/goldens/checked/` holds this dump, one file per module.

Goldens: `tests/cases/dump_*.stdout`.

## `-g` debug info

`src/debug.ts` builds the DWARF metadata; `IRFunction` (`src/ir.ts`) carries
the `subprogram` and the current location the emitter sets around every
statement and expression. Emitted: `!llvm.dbg.cu`, the `Dwarf Version` and
`Debug Info Version` module flags, a `DICompileUnit` (`DW_LANG_C99`, producer
`nish <version>`), a `DIFile` per source file (directory `.`), one `distinct
DISubprogram` per function (methods are `Owner.method`), `DILocation`s,
`llvm.dbg.value` for parameters and `llvm.dbg.declare` for locals and
`for...of` slots, with struct and array types described from the checker's
layouts.

- The directory is `.`, as with clang's `-fdebug-compilation-dir=.`, so a
  `-g` build depends only on the command line. An imported class is described
  against its own `DIFile`.
- A function's position is where its **declaration** starts (`export`,
  `const` or `function`), not its arrow (`tests/cases/dbg_arrow`).
- A `DILocation` column is a **byte** offset plus one, as `clang -g` writes
  (`tests/cases/dbg_utf8`); diagnostic columns are UTF-16 code units for an
  editor (`columnOf` and `byteColumnOf` in `src/diagnostics.ts`).

Without `-g` the IR is byte-identical. `--link -g` passes `-g` to
`scripts/build.sh`, which builds every input with it and drops the strip flag.
The `dbg_*` goldens pin the metadata, and the `-g` block of `tests/run.js`
verifies it with `opt -passes=verify`, links with two profiles, and checks the
line table names the `.ts` file, printing a visible `SKIP` when no DWARF tool
exists.
