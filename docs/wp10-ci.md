# WP10: CI and diagnostics

This page covers the GitHub Actions workflow, how to reproduce it on a
workstation, and the format every compile error is printed in.

## CI matrix

`.github/workflows/ci.yml` runs on every pull request and on pushes to
`main`. Scoping the `push` trigger to `main` is what stops a branch with an
open pull request from running the matrix twice over, once per event; the
comment above the `on:` block has the details.

| Job | Runner | Steps |
| --- | --- | --- |
| `test (ubuntu-latest)` | Ubuntu, LLVM 18 from apt (`clang-18 lld-18 llvm-18`) | `npm ci`, `npm run check`, `npm test`, size report |
| `test (macos-latest)` | macOS (Apple Silicon), Homebrew `llvm@18` | **out of the matrix**, on three remaining measured failures rather than on cost; see below |
| `seeds` | Ubuntu | asks the last release which seed binaries it attaches, and builds the `bootstrap` matrix from the answer. Green means it looked; **red** means a seed that should exist does not |
| `bootstrap (x86_64-linux)` | Ubuntu | builds `self/` with that seed, which is the only thing that checks WP19's rolling freeze. One row per seed that exists, so a platform with no seed has no row rather than a green one |
| `runner` | Ubuntu, LLVM 18 | the golden corpus again, through `tests/nish/run.ts` — the harness written in Nish (`npm run test:nish`). A compiler regression fails here and in `test`; a regression in the *runner*, or in `readdirSync` / `spawnSyncTo` / `monotonicNanos`, fails only here |
| `batch-parity` | Ubuntu, LLVM 18 | `node tests/run.js --batch-gate-only`: every golden case compiled both through the in-process batch and through the CLI, compared byte for byte, then stopped. `npm test` gates one case per shape; this widens it to the whole corpus |
| `lint` | Ubuntu | `npm run lint --if-present` (a no-op until `package.json` defines `lint`) |

`.github/workflows/parity.yml` is the fourth job and does not run here: WP19
G1's corpus half is nightly, on its own workflow, for the reasons under
[the parity run](#the-parity-run-nightly) below.

**The macOS `test` row was run for the first time on 2026-09-13, and it fails.**
That is new information rather than a guess, and it replaces the cost argument
that used to stand here: `npm test` on `macos-latest` reported **five failures in
four families**, none of them a compiler bug and all of them checks that encode
an ELF/Linux assumption. Three of the five are untouched; the `stage3 ==
stage2` family is **settled** below, and it was the one that reached past this
job.

| | What fails | Why |
| --- | --- | --- |
| 1, 2 | `llvm-dwarfdump` finds an empty `.debug_line` in the linked binary | On Mach-O `clang -g` leaves DWARF in the `.o` files; the executable carries a debug map and `dsymutil` is what produces a line table. Two checks read the executable |
| 3 | `--threads` IR **links** against a runtime built without `-DNISH_THREADS`, exit 0 | ELF refuses a TLS symbol against a non-TLS definition and ld64 does not. The safety net `build.sh`'s header describes does not exist on macOS — a finding about the platform, not about the check |
| 4, 5 | `stage3 == stage2` as files, at *identical size* (597,048 bytes both) | Every IR equality passes, so the compiler is deterministic and the linker is not. **Which bytes: settled** — `LC_UUID`, stable across two links to one output path and differing on a link to another, so two stages built at two paths could not agree. **What it varies with: not settled** — the output path is the leading explanation, not a finding. **The remedy: measured** — `scripts/bootstrap.sh` links them at one path now and both darwin rows come out byte-identical. `tests/self/bootstrap.js`, the other half of this family, still links at two — see below |

The `stage3 == stage2` family reached further than this job:
`scripts/bootstrap.sh --verify` asserted the same comparison, so it stood between the
release workflow and a **darwin binary**
([G5](wp19-stage0-retirement.md#g5--distribution-does-not-need-node)) as well
as between G3 and a macOS `bootstrap` row.

That one is **settled, by running it.** The comparison had moved into
`scripts/verify-binaries.sh`, where on Darwin it asserts the size, strips what
a tool on `PATH` can strip, and fails anything left over as *unattributed*
rather than as a compiler difference. That narrowing was an improvement on two
counts and a settlement on neither: it no longer accepted any difference at
all, which a blanket exemption would, and it no longer **misreported** a benign
difference as a broken fixed point, which the first version of it did — but it
could not let a real darwin bootstrap through, because *which* bytes ld64
varied had never been measured. Nobody had run it on a mac.

#### What ld64 varies, measured

Somebody has now. A throwaway workflow ran `release.yml`'s `binaries` steps on
both darwin rows on 2026-09-19, built three stages at `--profile speed` without
`--verify` so the comparison could not stop the job before it had said
anything, and attributed every differing byte to the load command, section or
linkedit blob it falls inside.

| Row | Runner | Size, both | Differing | Where |
| --- | --- | --- | --- | --- |
| `x86_64-darwin` | `macos-15-intel` | 649,808 | 16 bytes | `0x468`–`0x478`: `LC_UUID`'s sixteen bytes of UUID, and nothing else in the file |
| `aarch64-darwin` | `macos-latest` | 646,696 | 48 bytes | the same sixteen at `0x468`, plus 33 in the `LC_CODE_SIGNATURE` blob at `0x9ca81` — one SHA-256 code-directory slot |

`otool -l` diffed to the one `uuid` line on both rows. The arm64 row's extra 33
bytes are the signature and not a second cause: ld64 ad-hoc signs arm64
(`codesign -dvvv` reports `adhoc,linker-signed`) and that slot is the page hash
of the page `LC_UUID` sits on. The Intel row is the control for that claim —
ld64 does not sign there at all, and there the UUID is the whole of the
difference.

The debug map, which an even earlier version of this section named, was never
it: `scripts/bootstrap.sh` defaults to `--profile speed` and never passes `-g`,
so there is no DWARF in the `.o` files for ld64 to build a map from, and
`build.sh` had already dropped the local symbols at the link.

#### The candidate was right and its remedy is not available

`-Wl,-no_uuid` was the one-liner this section proposed, and it was tried on the
next run. It does what it says: with it both darwin rows link at the size they
linked at before and the binaries are byte-identical, and on `macos-15-intel`
the whole row went **green** — bootstrap, tarball, smoke test and all. On
`macos-latest` the row died one step further on, in the loader:

```
dyld[20816]: missing LC_UUID load command in .../selfhost/stage1
Abort trap: 6
```

**dyld on arm64 refuses an image that has no `LC_UUID`.** stage1 linked at
646,696 bytes and aborted the moment `bootstrap.sh` ran it to build stage2, so
the flag turns a reproducible compiler into one that does not start. ELF has no
loader that insists on a build id, which is why `--build-id=none` has always
been free on that side and this is not its Mach-O twin. So the flag is not in
`build.sh`; the Darwin branch links with `-Wl,-x` and keeps the UUID.

#### What the UUID varies with, and why the remedy holds either way

Ruling the flag out left the question that mattered: ld64 classic hashed the
output's own *content*, which would have made two links of one input agree, and
these did not. So the hash is over something else, and which something decides
whether the fixed point can be reached at all. Three links of one input by one
compiler, twice to the same output path and once to a different one, on both
rows:

| Link | Output path | `x86_64-darwin` | `aarch64-darwin` |
| --- | --- | --- | --- |
| 1 | `…/one` | UUID `1474A511…` | UUID `3715A948…` |
| 2 | `…/one` | identical to link 1, same UUID | identical to link 1, same UUID |
| 3 | `…/two` | 16 bytes differ, and the UUID with them | 51 bytes differ, and the UUID with them |

The **Link** column is the part to read with the **Output path** column: the
two that agree are also the two that ran first, which is what the next
paragraph is about.

**The UUID is stable across two links to one path, and differs on a link to
another** — with nothing else in the file moving. So it is not a hash of the
output's own content, which is what ld64 classic did and what would have made
any two links of one input agree.

**The output path is the leading explanation, and the probe does not rule out
an invocation counter.** The two same-path links were invocations 1 and 2 and
the differing-path link was invocation 3, and the probe never went back to the
first path — so path-identity and invocation-order are confounded. Anything
that had changed by the third link fits the same numbers: a coarse clock tick,
a per-session counter, an intermediate name derived from the path rather than
equal to it. A fourth link back to the first path, expected to reproduce the
*first* UUID, is the one line that would tell them apart, and it was not run.

**The remedy holds either way**, which is why this is recorded as it stands
rather than guessed at: run 4 below measured it end to end, and whatever
`LC_UUID` is a function of, two stages linked at one path agree.

Either way the failure was the harness's rather than the toolchain's:
`scripts/bootstrap.sh` linked stage2 at `$work/stage2` and stage3 at
`$work/stage3`, so two compilers that agreed about every other byte got two
different UUIDs, and the comparison could only ever call that unattributed.

Both are linked at `$work/stage` now and moved into place afterwards, so there
is nothing left for the UUID to differ about. It weakens nothing — `stage3 ==
stage2` is still a raw `cmp` of the two files, on Mach-O as on ELF — and it
costs one rename per stage. stage1 is left alone because nothing compares it to
a binary: `IR(seed) == IR(stage1)` compares the `.ll` files its build wrote, and
those are the same bytes wherever the executable landed.

Both darwin rows then report what Linux has always reported:

```
IR(stage0) == IR(stage1): 61 modules identical
IR(stage1) == IR(stage2): 61 modules identical
stage3 == stage2: byte-identical binaries
```

**The other half of that family is not fixed, and is now a one-line job.**
`tests/self/bootstrap.js` is a second implementation of the same chain — the
one `npm test` runs — and it links `<work>/stage2` and `<work>/stage3`, then
compares them with no Mach-O narrowing at all. It passes on ELF and would still
fail on a mac, for exactly the reason measured above. It wants the same
treatment: link both at one path and move each into place. That is what rows 4
and 5 of the table are, one check each, and settling the cause is what makes
the second one mechanical.

The Darwin narrowing in `verify-binaries.sh` stays, as a net under a comparison
that now holds rather than as the arm that decides a darwin row: it costs
nothing while the two files are identical, and it is what a toolchain that
starts varying something else would meet. `tests/run.js` still pins the LC_UUID
case as a **known limitation** of that script — a fabricated Mach-O pair
differing only in LC_UUID is reported unattributed rather than forgiven — and
that is now a statement about the script rather than about what a bootstrap
produces. `NISH_UNAME_S` lets the suite drive both platforms' branches from one
machine.

Restoring the `test` row means porting the other **three** checks in the two
families above against hardware that has to be iterated on, which is a package
of its own rather than a line in the matrix. The install half is already
written and was exercised by that run: both "Install LLVM 18 + lld" steps in
the `test` job are guarded by `runner.os`, so restoring the row is one
uncommented line plus those three fixes, plus the one-line shared-path change
`tests/self/bootstrap.js` wants. The `stage3 == stage2` family, which that
sentence used to end by deferring to an unmeasured question, is now that one
known change.

The two defects the row was waiting for before this are both bash 3.2,
which macOS ships as
`/bin/bash` (Apple will not ship GPLv3) and which this repository's shell
scripts had been written against:

- `scripts/build.sh` runs under `set -euo pipefail`, and in bash 3.2
  expanding an empty array as `"${arr[@]}"` while `set -u` is on raises
  *unbound variable* — bash 4.4 made it legal. `pgo`, `elf`, `strip_flag` and
  `libs` are all legitimately empty on the ordinary macOS path, so every
  `--link` at the `speed`, `size` and `napi` profiles died at
  `scripts/build.sh: line 96: pgo[@]: unbound variable`, before clang was
  reached. The nine sites spell it `${arr[@]+"${arr[@]}"}` now.
- `scripts/smoke.sh` collected its program list with `mapfile`, a bash 4
  builtin that bash 3.2 does not have at all, so the smoke step died on the
  first line that used it. It reads the same pipeline with `while read` now.

Neither stops the row now, and neither is what the failures above are.

### The seeded build, and what a missing seed reports

`bootstrap` builds `self/` with the **last released** binary rather than with
stage0, which is the only thing that checks WP19's rolling freeze
([G3](wp19-stage0-retirement.md#g3--the-seed-protocol-exists-and-ci-uses-it)).

**There are three answers and only two colours, so the freeze is a pair of
jobs.** `seeds` asks the last release which seed binaries it attaches — it
needs `gh` and the checkout, no Node and no LLVM, so it answers in seconds
rather than after two minutes of setup it may be about to throw away — and
`bootstrap` is a **matrix over that answer**, one row per seed that actually
exists. A platform with no seed therefore has no row, rather than a green one
with a warning inside it. Read the pair:

| The checks list says | It means |
| --- | --- |
| `seeds` green, a `bootstrap (<seed>)` row green | the freeze was checked with that seed, on that seed's own platform, and it held |
| `seeds` green, no row for a platform | the freeze was *not* checked there, and nothing is wrong: no release carries a seed for it yet. The `seeds` summary names every platform in both states |
| `seeds` green, `bootstrap` **skipped** | the same for every platform at once: there is no release at all |
| `seeds` **red** | a seed that should exist does not — a release missing an asset `release.yml` attaches |
| a `bootstrap` row **red** | `self/` does not build with the last release. That is the rolling freeze broken, and it is what this pair exists to catch |

An absent row, and a grey job where there is nothing at all, are the
distinctions the gate could not draw while it was one job. It has now been
wrong in both directions. It first named the asset it wanted, warned, and
exited 0 — and a warning above a green check is a green check, which is
precisely the shape
[§A5](wp19-stage0-retirement.md#a5-the-gate-reopened-and-the-correction-a4-needed)
is the written record of. The correction for that made every missing seed red,
which is the opposite error: `release.yml`'s `release` job is `needs: ci`, so a
repository with no release — the 0.1.0 base case
([wp12-release.md](wp12-release.md#release-procedure)), and every fork on the
day it is forked — could never cut the release that would supply the seed the
gate was waiting for.

**Which missing seed is red is decided by platform, and the list is data.**
[`.github/seed-targets.json`](../.github/seed-targets.json) carries all four of
G5's platforms, the canonical triple each one is, the asset name derived from
it, and whether `release.yml` attaches it today. So:

- **no release at all** — nothing to check the freeze against and nothing
  wrong. No rows, `bootstrap` skipped, `seeds` green and saying so.
- **a release with no asset for a platform marked `attached`** (`x86_64-linux`
  today) — a regression in `release.yml` or in the asset name the two workflows
  share. Red, and the annotation says how to get unstuck: attach the asset, or
  delete the release, before cutting another.
- **a release with no asset for a platform nothing builds for yet** (darwin and
  `aarch64-linux`, until
  [G5](wp19-stage0-retirement.md#g5--distribution-does-not-need-node)) —
  expected. No row for it, and the `seeds` summary lists it as unchecked.

The one thing this pair may not do is report success without having built
anything, and the one thing it may not do now is be red for a state in which
nothing is wrong.

**The lookup is a file, and `npm test` runs it.** `.github/seed-matrix.sh` is
the step body, and the WP19 block of `tests/run.js` drives it against a
stand-in for `gh` through each of those states — the seed present, the
`attached` seed missing (exit 1 with an `::error::`), a seed missing for a
platform nothing builds one for, no release at all, and a seed appearing for a
platform that had none. Both times this logic was got
wrong it was inline shell in a workflow that nothing could run; the checks are
what make the third revision of it the last one that needs a reviewer to catch
a regression.

`.github/seed-targets.json` is also where the *asset name* is spelled, once.
`release.yml` looks its own up rather than writing it out, and the same block
of `tests/run.js` checks every row against the compiler's own target table:
that each `triple` is one `src/codegen/target.ts` calls canonical, and that
each `asset` is that triple with the vendor and the ABI dropped
(`x86_64-unknown-linux-gnu` → `x86_64-linux`, `aarch64-apple-darwin` →
`aarch64-darwin`). The four spellings used to live in two comments calling each
other a contract, and two of them — `aarch64-darwin` and `x86_64-darwin` — were
described as triples the compiler accepts, which it never has.

G3 asks for this on **both** operating systems, and it runs on Linux alone.
v0.2.0 attaches `x86_64-linux` and nothing else and a published release cannot
grow an asset, so the earliest any second row could appear is the next release.
The darwin pair's `attachedSince` is 0.4.0 and so is
`aarch64-linux`, and **all three have now been exercised** on the hardware
their rows name. Two things had to land before the second platform, and both
have:

- the darwin **seed**, which is
  [G5](wp19-stage0-retirement.md#g5--distribution-does-not-need-node), and
  which `release.yml` now builds — one per target, from
  `.github/seed-targets.json`.
- the **ld64 fixed point** — the `stage3 == stage2` family in the table above,
  settled by the measurement in that section and by the shared link path it led
  to. Before it, a darwin `binaries` row was as likely as not to fail as
  *unattributed* and take the release with it, which is why those two versions
  were set past the release that was then next. `aarch64-linux` shared the
  version for a different reason: it is ELF, so none of the ld64 problem ever
  applied to it, and it waited only on an exercising run — which makes it the
  natural first row to attach.

Neither is a line in `ci.yml`: the matrix is the release's answer, so the row
appears when the seed does, on the runner `seed-targets.json` names for it —
and because it is *presence* and not `attachedSince` that builds the row, a
platform's rows want exercising once before its version arrives. That file's
note says so under BEFORE ADDING A PLATFORM.

**`aarch64-linux` was briefly set one release earlier, at 0.3.0, on an
argument worth recording because it was sound about the wrong hazard.** It is ELF, so the `ld64` comparison does
not apply to it; and the release-time half looks fail-safe, since a failing
`binaries` row attaches nothing. Both true. But the half that is *not*
fail-safe triggers on the row **succeeding**: once the asset is attached,
`ci.yml` grows an ARM `bootstrap` row on every push and pull request, a red row
there is red CI repo-wide, `release` is `needs: ci`, and lowering
`attachedSince` does not clear a row that presence created — only deleting a
published asset does. So "bounded at release time" covered the unlikely outcome
and left the likely one uncovered. And the release it would have landed on
publishes to npm and is merged by a person, who should not be handed a debug
cycle at that moment.

It is `0.4.0` with the others, and the rule below has no exceptions. A rule
the file states and the row beneath it breaks is weaker than no rule, because
the next person cites the exception.

Exercising a platform's rows first is the better answer, and the two obvious
ways of doing it are both closed: `release.yml` cannot be dispatched at a
branch, since `targets` exits unless the ref is a tag matching
`package.json`'s version, and a temporary matrix entry in it cannot be reached
for the same reason. What works is a throwaway workflow on a branch —
`on: workflow_dispatch`, one job on the label in question, the `binaries`
steps down to the smoke test, no upload — deleted once it has been green.
Teaching `release.yml` a dry-run input would be the principled fix and is
deliberately not part of this: it adds a path to the publishing workflow that
has itself never run.

**That is what was done, and it is what the three versions above rest on.** The
throwaway took its matrix from `.github/seed-due.sh`'s answer inverted — every
row this version is *not* due, which is exactly the set no release has carried
— and ran the `binaries` steps on all three at once, with `fail-fast: false` so
a red row would name itself:

| Run | `aarch64-linux` | `aarch64-darwin` | `x86_64-darwin` |
| --- | --- | --- | --- |
| [1, as things stood](https://github.com/amritk/nish/actions/runs/35431909673) | **green**, through the smoke test | measured; `--verify` red as *unattributed* | measured; `--verify` red as *unattributed* |
| [2, with `-Wl,-no_uuid`](https://github.com/amritk/nish/actions/runs/35432446491) | green | **red in dyld**: the linked stage1 will not start | **green**, byte-identical |
| [3, the flag reverted, probing the UUID](https://github.com/amritk/nish/actions/runs/35432749109) | green | red as *unattributed*, and the probe answered | red as *unattributed*, and the probe answered |
| [4, both stages linked at one path](https://github.com/amritk/nish/actions/runs/35433181271) | green | **green**, byte-identical | **green**, byte-identical |

One thing the note could not have known: `workflow_dispatch` needs
`actions: write`, and the token the runs were driven from has `actions: read`,
so the API answered 403. The throwaway carried a branch-scoped `push:` trigger
as well — same jobs, same hardware, same steps — and went away with the branch.


### The parity run, nightly

`.github/workflows/parity.yml` runs `node tests/run.js --parity` on a
`schedule:` at 06:17 UTC, and on `workflow_dispatch` with an optional `only`
filter. It is the corpus half of WP19 G1: every program in the corpus through
both compilers under all fifteen flag variations, comparing exit status,
stdout, stderr and every file written.

It is a workflow of its own rather than a step in `test` because of what it
costs — roughly 9,000 compilations by each compiler, plus linking a stage1
binary first, which is forty minutes against three for `npm test`. The
flag-set half is the opposite trade and already runs inside `npm test`: two
`--help` runs, seconds, and it is the half that found `--no-warn-performance`
and `--out-dir`.

Nightly rather than on demand because the gate has already reopened once in
the gap between runs, and nobody noticed until it was run by hand
([wp19 §A5](wp19-stage0-retirement.md#a5-the-gate-reopened-and-the-correction-a4-needed)).
The job writes its summary line into the run summary with the date, because
that number is a fact about the corpus on the day it was measured. A red
result is a gate, not a flake.

**And a run summary is still somewhere somebody has to look.** Running nightly
fixes "nobody remembered to type the command"; it does not fix "nobody opened
the run", which is the same silence one step further out — the gate goes red
on a Tuesday and the record still reads green until somebody scrolls back
through Actions. So the job carries its own verdict into the repository: a
**full** run that is not green opens the issue *WP19 G1: the parity gate is
not green*, or comments on the one already open so that a week of red is one
thread rather than seven, and a full run that is green closes it. Two states
open it, because both leave the day unproved — an undeclared difference, and a
run that never reached the mode at all.

Only a full run may touch that issue. A `workflow_dispatch` with an `only`
filter reports into the job summary and nowhere else, because a green subset
of the corpus read as a green corpus is exactly the mistake
[§A5](wp19-stage0-retirement.md#a5-the-gate-reopened-and-the-correction-a4-needed)
records.

**The writing is a second job, and that is a permission boundary rather than
tidiness.** `issues: write` is the only authority this workflow needs beyond
`contents: read`, and the job that would otherwise hold it runs `npm ci` and
then thousands of compilations of whatever is in the tree — repository code and
its dependency tree, with a token that can open, comment on and close issues.
So the workflow is `contents: read`, the corpus job inherits that, and a
`record` job that runs nothing but `gh` asks for `issues: write` for itself and
reads the run's log as an artifact. It is also where "only a full run may touch
the issue" now lives, as a job condition rather than a step condition: for a
filtered run the job does not exist.

Both `test` jobs need the plain tool names `clang`, `llc`, `llvm-as`, `opt`,
`ld.lld` and `wasm-ld` on `PATH`, because `tests/run.js` and the scripts
probe for exactly those:

- Ubuntu installs the versioned Debian binaries (`clang-18`, `llc-18`, ...)
  and symlinks them under `$RUNNER_TEMP/llvm-bin`, which is prepended to
  `PATH` via `$GITHUB_PATH`. This wins over whatever `/usr/bin/clang` the
  runner image ships.
- macOS prepends `$(brew --prefix llvm@18)/bin`. Homebrew's `llvm@18` bundles
  lld (including `wasm-ld`); the workflow installs the standalone `lld`
  formula only if that ever stops being true, because `lld` pulls in the
  newest LLVM as a dependency.

After the tests, the job compiles `examples/add.ts`, runs
`scripts/size-report.sh --markdown`, and appends the table to the job summary
so the size of every profile (`debug`, `speed`, `size`, `wasm`) is visible on
the run page for each OS. A `concurrency` group cancels superseded runs of
the same branch.

## Where the wall clock goes

Measured on 2026-09-18, run 474 on `main` (`a89bee7`), six jobs on
`ubuntu-latest`:

| Job | Duration | The step that is nearly all of it |
| --- | --- | --- |
| `batch-parity` | **18 m 21 s** | the corpus compiled both ways, 18 m 05 s |
| `test` | 15 m 42 s | `npm test`, 14 m 44 s |
| `runner` | 6 m 08 s | the corpus through the Nish runner, 5 m 49 s |
| `bootstrap` | 1 m 11 s | `self/` built with the seed, 51 s |
| `lint` | 10 s | — |
| `seeds` | 8 s | — |

The jobs run in parallel, so the workflow's wall clock is the longest of them:
**18 m 27 s**. Everything else — `npm ci` behind `setup-node`'s cache, the apt
install of LLVM 18, `tsc` — is seconds, and none of it is worth attention.

### Benchmarking each part

`scripts/ci-profile.mjs` answers "which check" rather than "which job". It
spawns a suite command, timestamps every line it prints, and attributes each
gap to the check that closed it:

```bash
node scripts/ci-profile.mjs                    # node tests/run.js
node scripts/ci-profile.mjs --top 60 --json    # machine-readable
node scripts/ci-profile.mjs -- npm run test:nish
```

It profiles the **unfiltered** run on purpose. Narrowing with
`node tests/run.js <substring>` is not a measurement of anything until
`rm -rf build/test`, and fifteen `fs.existsSync` guards drop checks with no
`SKIP` line to say so (`.claude/testing.md` has both traps); profiling from
outside the process avoids each of them. Read the expensive rows and not the
cheap ones: the suite makes 234 `spawnSync` calls, each of which blocks the
event loop, so queued writes flush in bursts and the order *within* a burst
carries no timing information.

What it reported for `npm test` on that commit — 660.5 s locally, against the
runner's 14 m 44 s, so this box is about 1.34x a `ubuntu-latest`:

| Check | Cost |
| --- | --- |
| `self/emit.ts emits the IR stage0 emits` (420 programs, 1,805 modules) | 90.1 s |
| `codes: every registry code is provoked by a program or explained` | 80.0 s |
| `self/checker.ts agrees with stage0 on what it accepts` (396 files) | 70.5 s |
| `differential` (4 checks, 173 programs) | 51.1 s |
| `self/ compiles self/: the bootstrap reaches a fixed point` (61 modules) | 46.1 s |
| `self/emit.ts` over random programs (fuzz) | 22.4 s |
| `self/ writes the interop sidecars stage0 writes` | 21.6 s |
| `self/ refuses what stage0 refuses` (377 fragments) | 18.4 s |
| `self/ prints what tests/self/goldens/ records` | 17.0 s |
| `the bootstrap script: a stage0 seed asserts IR(stage0) == IR(stage1)` | 16.3 s |

The ten of them are 70% of the run, and the WP14 self-hosting block alone is
about 330 s of it.

### The one cost behind most of that list

Almost none of it is compiling Nish. `tests/batch_worker.js` measured one
`node dist/index.js <case>` at about 634 ms, of which **1.5 ms** is compiling:
36 ms is Node starting, ~473 ms is `import ts from "typescript"`, and ~85 ms is
loading `dist/`. Section A of `tests/run.js` already avoids paying it by driving
the library API in process — that is the difference between six minutes and a
handful of seconds — but the oracles and `tests/diagnostic_coverage.js` cannot:
what they compare is what the *command line* answers, so a process per program
is the thing under test rather than an implementation detail.

Two things follow, and the workflow does both.

**The import is made cheaper.** `NODE_COMPILE_CACHE` is set for every job in
`ci.yml`, which caches V8's compilation of every module Node loads, keyed on
content and Node version; a missing or stale key costs time and cannot change an
answer. Measured here: 412 ms → 315 ms for one compiler spawn (−24%),
`tests/diagnostic_coverage.js --require-coverage --strict-refusals` 77.0 s →
65.5 s (−15%), and the whole of `npm test` 660.5 s → 627.3 s (−5.0%), with the
run undegraded at 1,909 passed, 0 failed, 2 skipped either way — read the skip
count, not the exit status. The suite's tail is clang and native runs rather than
Node, which is why 24% per spawn is 5% per suite.

**The duplicate is removed.** `--verify-batch` changes exactly one thing about a
run — the set the batched-compile gate is taken over — and then makes every other
check in `tests/run.js` a second time, on the same commit the `test` job is
already making them on. `batch-parity` is the longest job in the workflow, so
that duplicate was the workflow's wall clock.

`--batch-gate-only` widens the same gate and stops after it. Measured on this
box at `a89bee7`, both modes on the one commit: **105.8 s against 684.9 s**, a
6.5x cut. It makes 1,780 of the full mode's 2,560 checks, and the 780 it leaves
out are exactly the checks the `test` job makes on the same commit — which is the
whole argument for leaving them out. It reports as the narrow run it is, with a
counted skip naming what it did not check, because a green that claims more than
it proved is the one thing this suite may not print.

The counts move with the corpus and the ratio does not, so re-derive them rather
than quoting these. The split is structural: the narrow run is section A plus the
widened gate, and every check the suite has added since sits *after* the gate. At
`16110e2`, one commit later, the plain run had grown to 1,937 checks and the
narrow run was still 1,780 of them, at 116.9 s.

### What is still on the table

The `test` job is now the wall clock, and the WP14 self-hosting block is about
half of it. The block is already a set of separate child processes
(`tests/self/*_oracle.js`), so moving it to a job of its own would take the
workflow to roughly eight minutes. What stands in the way is not the runner but
the accounting: `tests/run.js` has no way to run one section and *say* it ran
one section, and the substring filter is the trap described above. A `--section`
mechanism with honest skip counting is the piece of work that unlocks it.

`tests/diagnostic_coverage.js` is the other one: 80 s, ~600 CLI spawns, ~99% of
it the import above. It pools four wide already, and pool width does not help
(76.9 s at `--jobs 4`, 73.9 s at 8, 77.1 s at 12 on four cores) because the
cores are saturated. Batching it the way `tests/batch_compile.js` batches
section A would take it to seconds — but it reads `--json` off a command line by
design, so that is a rewrite of a gate rather than a tuning knob.

## Running the same steps locally

```bash
# Ubuntu / Debian
sudo apt-get install -y clang-18 lld-18 llvm-18
# then either update-alternatives or a symlink dir, e.g.
mkdir -p ~/.local/llvm-bin
for t in clang clang++ llc llvm-as opt ld.lld wasm-ld; do ln -sf /usr/bin/$t-18 ~/.local/llvm-bin/$t; done
export PATH=~/.local/llvm-bin:$PATH

# macOS
brew install llvm@18
export PATH="$(brew --prefix llvm@18)/bin:$PATH"

npm ci
npm run check           # tsc --noEmit
npm test                # build + tests/run.js (goldens, llvm-as, native, runtime, size, wasm)
npm run lint            # only if package.json defines it
npm run size-report     # the plain table; add --markdown via scripts/size-report.sh
```

`scripts/build.sh` and `scripts/size-report.sh` branch on `uname`: on macOS
they use ld64's `-dead_strip` / `-x` instead of `--gc-sections` / `-s`, skip
`-fuse-ld=lld` and `-fno-plt`, and strip the padding macOS `wc -c` adds. The
`wasm` profile asks `clang -print-prog-name=wasm-ld` where the linker is, so a
Homebrew LLVM works even when its bin dir is not on `PATH`; when no `wasm-ld`
exists the size report omits the row and `build.sh --profile wasm` exits 2
with a message.

## Diagnostic format

Every error the compiler reports, whether from the parser or the checker, is a
`CompileError` (`src/diagnostics.ts`) and is printed to stderr in this shape:

```
tests/cases/reject_type_mismatch.ts:1:40: error: Operator `+` requires two operands of the same numeric type, got i32 and boolean
  1 | function f(a: number): number { return a + true; }
    |                                        ^~~~~~~~
```

- Line 1 is the summary: `<file>:<line>:<col>: error: <message>`, with 1-based
  line and column of the start of the offending node. This line is unchanged
  from earlier releases, so tests that match a substring of it keep passing.
- Line 2 is the source line, prefixed with the line number and ` | `.
- Line 3 is the caret line: `^` under the node's start column, then `~` up to
  the end of the node's text on that line (a node that spans several lines is
  marked only on its first line). Tabs in the source are reproduced in the
  caret line so the markers stay aligned in a terminal.

Syntax errors from the TypeScript parser use the same layout with the
`syntax error:` prefix (`StaticSyntaxError`, a `CompileError` subclass):

```
build/test/diag_syntax.ts:2:10: syntax error: ':' expected.
  2 |   return 1;
    |          ^
```

The `CompileError` object exposes `file`, `line`, `column`, `summary` (the
first line) and `excerpt` (the two excerpt lines) for tooling that wants the
parts separately; `message` is always `summary + "\n" + excerpt`.

Tests for the format live in the `// ---- WP10: diagnostics` block of
`tests/run.js`.

## Multi-error reporting

The compiler no longer stops at the first error. Every phase that can
recover hands its `CompileError`s to one `DiagnosticSink`
(`src/diagnostics.ts`) owned by the `Compilation`:

| Phase | Recovery unit | Where |
| --- | --- | --- |
| Parser | every parse diagnostic of the file | `parseSource` |
| Phase 0 validator | every forbidden construct (a rejected node's subtree is skipped, so `Array<any>` is one error) | `validateNish` |
| Pass 1 (signatures) | per declaration: class/interface (marked `poisoned`, its layout checks skipped), import, function signature, module resolution | `Checker.collectSignatures`, `Compilation.load` |
| Pass 1b/1c | per import binding; every symbol clash | `Checker.bindImports`, `Compilation.rejectSymbolClashes` |
| Pass 2 (bodies) | per statement, at the innermost statement list; the enclosing function is marked `poisoned` and its definite-return check is skipped | `checkStatements` |

Between phases `DiagnosticSink.throwIfErrors` sorts what was collected (files
in load order, then line and column), throws the first error as a plain
`CompileError` and attaches the rest as `error.additional`. So a caller that
only knows single errors (`compileToIR`, older tests) still gets exactly the
message it always got, pass 2 never runs over broken signatures, and the
emitter never sees a poisoned function.

The driver prints `formatErrorReport`: each error's summary and excerpt, at
most 20 (`MAX_REPORTED_ERRORS`) before `...and N more errors`, then an
`N errors` line. A lone error prints exactly its message, as before. To
limit cascades, `let x: T = <rejected>` still declares `x` as `T`, and
unreachable code is reported once per statement list.

Tests: `tests/cases/reject_multi_error` (three body errors), `reject_multi_forbidden`
(three Phase 0 errors), `reject_multi_decl` (three declaration errors). A
`.err` golden may now hold several lines, each a fragment that must appear.

## `--json`

`nish --json file.ts` prints one JSON object per error on stdout, nothing
else on stdout and nothing on stderr, with the same exit code:

```
{"file":"tests/cases/reject_multi_error.ts","line":2,"column":10,"endLine":2,"endColumn":18,"severity":"error","code":"NL2231","message":"Operator `+` requires two operands of the same numeric type or two strings, got i32 and boolean"}
```

`line`/`column` are 1-based, `endLine`/`endColumn` exclusive. `severity` was
always `"error"` here; since WP15 §8 it is `"error"` for every error and
`"performance"` for a performance warning, which is the field a tool filters
on. Syntax errors keep the `syntax error: ` prefix in `message`.

### `code`

`code` is the stable identifier for the rule that was broken, and it is the
field to key on: the prose in `message` is allowed to improve between releases
and the code is not. The registry is `src/codes.ts` and its stage1 twin
`self/codes.ts`, both generated by `scripts/gen-diagnostic-codes.mjs` from the
compiler's own diagnostic sites, so a diagnostic added without a code fails
`npm test` rather than shipping. The generator only ever appends numbers, and a
retired rule keeps its number reserved.

The band says which phase refused the program:

| Band | Meaning |
| --- | --- |
| `NL0000` | no rule matched this message yet (see the backlog below) |
| `NL0001` | a syntax error; the text is the `typescript` package's, so all of them share one code |
| `NL0002` | the C toolchain `--link` needs could not be used (exit 3) |
| `NL0003` | an internal compiler error (exit 70) |
| `NL1xxx` | Phase 0, the forbidden-syntax sweep (`src/validator.ts`) |
| `NL2xxx` | the checker: signatures, bodies, types |
| `NL3xxx` | the driver and module loading |
| `NL4xxx` | the interop sidecar generators |
| `NL9xxx` | a WP15 §8 performance warning |

A code is matched against the longest literal run of the message's template —
the rule stated in words, with the interpolated names, types and counts
removed. A handful of messages are built entirely out of interpolations
(`` `${fn}` expects ${a}, got ${b} ``) and have no run long enough to identify
a rule; those report `NL0000`. `tests/run.js` pins how many there are, so the
backlog can shrink but not grow. Giving one a code is a matter of giving the
message words of its own, not of editing the table.

Codes appear in `--json` only. The human summary line
`file:line:col: error: <text>` is unchanged, because the `.err` goldens and
`tests/self/reject_oracle.js` match on it byte for byte.

### Failures without a source position

Every failure is a parseable line under `--json`, not just the ones with a
span, so a wrapper that asked for JSON is never left with an empty stdout and
an exit code to guess about:

```
{"severity":"error","code":"NL0002","message":"--link: no usable C compiler found (...)"}
{"severity":"error","code":"NL0003","message":"internal compiler error while compiling a.ts: ..."}
```

A driver error (a bad `-o` layout, an unreadable input) has the same shape and
takes whatever code the registry resolves for its text, or `NL0000`. The human
report still goes to stderr in the internal-error case, because a crash is
worth seeing twice.

## `--emit-ast` and `--emit-checked`

Both write to stdout instead of IR (`src/dump.ts`); file names are printed
relative to the working directory.

- `--emit-ast`: the syntax tree of every module after Phase 0, one node per
  line, `<SyntaxKind> <line:col>-<line:col>` (start without trivia, end
  exclusive) with identifier and literal text appended. Token kinds use their
  real names (`EqualsToken`, not `FirstAssignment`).
- `--emit-checked`: after every checker pass and the attribute analysis: per
  module `struct` lines (kind, size, align, fields with index and byte offset,
  `readonly`/`initialized`, constructor and method symbols), `import` lines,
  and `function` lines (resolved signature, `@symbol`, `[exported]`
  `[method]` `[constructor]` `[entry]`), each followed by its `facts:`
  (effect, willReturn, loops, ...), `pointer <param>:` facts, and `local` /
  `callee` lines in source order.

Goldens: `tests/cases/dump_ast.stdout`, `tests/cases/dump_checked.stdout`
(`tests/run.js` compares stdout when a `.stdout` sidecar exists).

## `-g` debug info

`src/codegen/debug.ts` builds the DWARF metadata; `IRFunction` gained a
`subprogram` (`define ... !dbg !N`) and a current location that `emit`
appends as `, !dbg !N`, set by the emitter around every statement and
expression and restored afterwards. Emitted: `!llvm.dbg.cu`, the
`Dwarf Version`/`Debug Info Version` module flags, a `DICompileUnit`
(`DW_LANG_C99`, producer `nish <version>`), a `DIFile` per source file a
declaration comes from (name as given, directory `.`), one `distinct
DISubprogram` per function (methods are
`Owner.method`; the `@main` wrapper is an artificial `main` at the user's
`main`), `DILocation`s, `llvm.dbg.value` for parameters, `llvm.dbg.declare`
for `let`/`const` and `for (const x of a)` slots. Types: `int`, `long`,
`double`, `bool`, `char*`, struct pointers to `DICompositeType`s with the
checker's offsets, array pointers to `{ long len; long cap; T* data; }`.

The directory is `.` rather than the working directory, which is what clang's
`-fdebug-compilation-dir=.` writes: a `-g` build then depends only on the
command line, so it is reproducible across machines, and stage1 — which has no
`process.cwd()` to ask for and no runtime budget to grow one (WP14 D4) — emits
the same bytes. A class reached through an import is described against *its
own* `DIFile` and line numbers rather than the importing module's, which is why
there is more than one `DIFile` in a program with imports
(`tests/link/reachable_struct`).

A function's own position — the `DISubprogram`'s `line` and `scopeLine`, its
parameters' `DILocalVariable`s, and the `DILocation` the prologue and any
untied instruction carry — is where the **declaration** starts: `export`, or
`const`, or `function`. Not the arrow. stage0 used to read it off the
`ArrowFunction`, whose own start is its parameter list, which put the same
function at two different positions depending on which of WP22's two spellings
declared it and named the wrong line whenever the arrow sat below its `const`;
`FunctionSig.declSite` is the node the checker records for it now
(`tests/cases/dbg_arrow`, `docs/wp19-stage0-retirement.md` §A5). Stage1 never
had the bug, because its parser normalises both spellings into one node that
spans the declaration.

A `DILocation` column is a **byte** offset into its line, plus one — what
`clang -g` writes and what a debugger reads it back against. stage0 used to
count the UTF-16 code units the `typescript` API hands it, which differs from
stage1's byte count for every position after a non-ASCII character on the same
line (`tests/cases/dbg_utf8`). Diagnostic columns are a separate question and
are still code units on stage0: the consumer there is an editor.

**Both compilers emit it.** `self/debug.ts` is the stage1 port, `-g` is a flag
of `self/compile.ts` as it is of `src/index.ts`, and `tests/self/ir_oracle.js`
compares the two byte for byte, metadata numbering included.

`--link -g` passes `-g` to `scripts/build.sh`, which adds `-g` for every
input (so `runtime.c` has symbols too) and drops the strip flag of the
speed/size/napi profiles. Without `-g` the IR is byte-identical (every golden
is unchanged). `tests/cases/dbg_locals` is the `-g` golden (the harness
replaces the repository path with `<root>`); the `-g` block of `tests/run.js`
verifies it with `opt -passes=verify`, links a program with
`--profile debug` and with the speed profile, and checks that
`llvm-dwarfdump --debug-line` (or `objdump --dwarf=decodedline`) lists the
`.ts` file with at least one row, printing a visible `SKIP` when neither
tool exists.
