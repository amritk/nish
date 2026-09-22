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
| `test (ubuntu-latest)` | Ubuntu, LLVM 18 from apt (`clang-18 lld-18 llvm-18`) | `npm ci`, the seed (`scripts/fetch-seed.sh`), `npm run check`, `npm test`, then the smoke test, the cookbook check, `gen-diagnostic-codes.mjs --check` and the size report, the compiling ones with `build/nish` |
| `test (macos-latest)` | macOS (Apple Silicon), Homebrew `llvm@18` | **out of the matrix**, on six remaining measured failures rather than on cost. It is the one macOS gap in the file: `bootstrap` and `nish-cmp` have had darwin rows since the 0.4.0 seeds. See below |
| `seeds` | Ubuntu | asks the last release which seed binaries it attaches, and builds the `bootstrap` matrix from the answer. Green means it looked; **red** means a seed that should exist does not |
| `bootstrap (x86_64-linux)` | Ubuntu | builds `self/` with that seed, which is the only thing that checks WP19's rolling freeze. One row per seed that exists, so a platform with no seed has no row rather than a green one |
| `nish-cmp (x86_64-linux)` | Ubuntu, LLVM 18 | WP19 G2.1: the corpus compiled with the **last released** compiler and with the one HEAD builds, every byte compared. One row per Linux seed a release carries, and no row at all until a release carries a seed that can compile the corpus — `cmpSince` in `.github/seed-targets.json` decides which, and its note says why that is not the first release |
| `runner` | Ubuntu, LLVM 18 | fetches the seed, then the golden corpus again, through `tests/nish/run.ts` — the harness written in Nish (`npm run test:nish`). A compiler regression fails here and in `test`; a regression in the *runner*, or in `readdirSync` / `spawnSyncTo` / `monotonicNanos`, fails only here |
| `lint` | Ubuntu | `npm run lint --if-present` (a no-op until `package.json` defines `lint`), and `node docs/check-links.mjs` |

Every job that compiles anything compiles it with `self/`, built from the
seed: there is no other compiler in the repository. Until WP19 R6 deleted
`src/`, the workflow also carried the jobs that compared the two
implementations — `batch-parity`, `parity-select` and `parity-changed` in this
file, the nightly `parity.yml` beside it, and the `ddc` job in `release.yml` —
and they went with it, because each one's subject was stage0
([the parity run](#the-parity-run-retired) below).

`nish-cmp` shares the `seeds` job with `bootstrap` and is a matrix for the same
reason, so the table of conclusions under
[the seeded build](#the-seeded-build-and-what-a-missing-seed-reports) reads for
both: an absent row means no comparison happened, and never that one happened
and passed. It is the successor to `tests/self/ir_oracle.js` and
`tests/self/interop_oracle.js`, the two largest of the six oracles WP19 R6
deleted with `src/`, and the axis it compares on is the one that survived that
deletion — not two implementations against each other, but the last release
against HEAD.

**The macOS `test` row has been run twice, and each run is a list of named
checks rather than a verdict on the platform.** 2026-09-13 (WP19 R2) was the
first: `npm test` on `macos-latest` reported **five failures in four
families**. 2026-09-21 was the second, with the row in the matrix and three of
those five ported first: `2125 passed, 6 failed, 4 skipped`
([run 606](https://github.com/amritk/nish/actions/runs/35652075129)). Across
the two runs that is nine distinct checks, and not one of them is a compiler
bug — every one read an ELF fact out of a **linked binary** instead of the
property it exists for, which is why the table below is by cause.

| | What failed | Why, and where it stands |
| --- | --- | --- |
| 1, 2 | `llvm-dwarfdump` finds an empty `.debug_line` in the linked binary | On Mach-O `clang -g` leaves the DWARF in the `.o` files and the executable keeps only a debug map naming them; the Darwin driver runs `dsymutil` at the end of a compile-and-link to turn that map into the `.dSYM` bundle that holds the table. **Ported, 2026-09-21** — `lineTableOf` in `tests/run.js` answers with the file the platform used, and both checks assert the same sentence about it on both platforms: the table names `dbg_main.ts` and has at least one row. Running `dsymutil` afterwards is deliberately *not* a fallback: by then clang has deleted the objects the map names, so the tool warns per object, writes an empty table and exits 0 |
| 3 | `--threads` IR **links** against a runtime built without `-DNISH_THREADS`, exit 0 | ELF refuses a TLS reference to a non-TLS definition and ld64 does not, so the safety net `build.sh`'s header describes is a fact about ELF. **Ported, 2026-09-21** — the property both platforms can be held to is that the mismatch is never quietly a working-looking program, and on Darwin it is not: `nm -m` shows `_nish_arena` as a plain `(__DATA,__common)` symbol where a thread-local descriptor should be, so the first allocation calls the arena's own `buf` field as the descriptor's thunk and the process dies with `Segmentation fault: 11`. The matched build of the same two inputs prints `alloc_smoke delta = 16` and exits 0, which is what makes the crash the mismatch's. The check's name says which mechanism caught it |
| 4, 5 | `stage3 == stage2` as files, at *identical size* (597,048 bytes both) | Every IR equality passes, so the compiler is deterministic and the linker is not. **Which bytes: settled** — `LC_UUID`, stable across two links to one output path and differing on a link to another, so two stages built at two paths could not agree. **What it varies with: not settled** — the output path is the leading explanation, not a finding. **The remedy: measured** — `scripts/bootstrap.sh` links them at one path now and both darwin rows come out byte-identical. `tests/self/bootstrap.js`, the other half of this family, still links at two — see below |
| 6 | `runtime objects: a --threads module refuses to link against the default runtime` | Row 3's finding, in the gate on the prebuilt object cache. First seen on 2026-09-21 because the object cache is newer than the 2026-09-13 run; it wants row 3's treatment |
| 7 | `the self-hosted compiler: -g reaches the compiler and the linked program carries DWARF` | Rows 1–2's cause, read through `.debug_info` rather than `.debug_line`. It wants `lineTableOf` |
| 8, 9 | both `runtime objects: linking <case> against <runtime> gives the bytes the sources do` | Rows 4–5's cause: the two links being compared are made to two *different* output paths (`<stem>.src` and `<stem>.obj`), so `LC_UUID` differs and the binaries are the same size and not equal. The comment above those checks already names the honest narrowing — a counted skip — if the byte equality turned out to be platform-specific, which it now has |
| 10 | `verify-binaries: NISH_UNAME_S says on stderr that it overrode the platform` | A check that drives `verify-binaries.sh`'s Darwin branch *from Linux* and reads the sentence saying the platform was overridden. On a mac there is no override to report, so this one is about the simulation rather than about the platform |

Rows 1–3 are ported. Rows 4–5 are settled for `scripts/bootstrap.sh` and open
for `tests/self/bootstrap.js`. Rows 6–10 are the six checks the `test` row is
still held out by, and the comment beside `os:` in `ci.yml` lists them with the
run that measured them so the two cannot drift.

The macOS row also reports **4 skips** rather than Linux's 2, and both extras
are counted facts about the platform written into the checks themselves: the
runtime `.text` budgets are a ceiling measured on `linux-x64`, and
`verify-binaries`'s Mach-O debug-map arms need a toolchain that produces two
binaries of one size differing only in a debug section, which this one does
not.

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

Both darwin rows then reported what Linux had always reported. The seed in
that run was still stage0, which is why its first line is an assertion; a
released seed's `IR(seed) == IR(stage1)` is reported rather than asserted
([wp12-release.md](wp12-release.md#the-bootstrap-seed)):

```
IR(stage0) == IR(stage1): 61 modules identical
IR(stage1) == IR(stage2): 61 modules identical
stage3 == stage2: byte-identical binaries
```

**The other half of that family is not fixed, is now a one-line job, and has
been watched failing.** `tests/self/bootstrap.js` is a second implementation of
the same chain — the one `npm test` runs — and it links `<work>/stage2` and
`<work>/stage3`, then compares them with no Mach-O narrowing at all. It passes
on ELF, and on 2026-09-21 it failed on a mac exactly as predicted: `stage3 is
not byte-identical to stage2 (646792 vs 646792 bytes)`, the same size on both
sides, in
[run 606](https://github.com/amritk/nish/actions/runs/35652075129). It wants
the same treatment: link both at one path and move each into place. That is
what row 4 of the table is, and rows 8 and 9 are the identical mistake in two
more checks — the two `runtime objects:` byte comparisons, which link `.src`
and `.obj` — so settling the cause is what makes all three mechanical.

The Darwin narrowing in `verify-binaries.sh` stays, as a net under a comparison
that now holds rather than as the arm that decides a darwin row: it costs
nothing while the two files are identical, and it is what a toolchain that
starts varying something else would meet. `tests/run.js` still pins the LC_UUID
case as a **known limitation** of that script — a fabricated Mach-O pair
differing only in LC_UUID is reported unattributed rather than forgiven — and
that is now a statement about the script rather than about what a bootstrap
produces. `NISH_UNAME_S` lets the suite drive both platforms' branches from one
machine.

Restoring the `test` row means porting the **six** checks in rows 6–10 above,
and what that costs is now known rather than estimated: each of the three
causes has been measured on the platform, and two of the three already have a
worked port in the tree to copy. Rows 6 and 7 are one check each, in the shape
rows 1–3 took. Rows 8 and 9 are the `LC_UUID` cause in `tests/run.js` and row 4
is the same cause in `tests/self/bootstrap.js`, which is the one-line
shared-path change `scripts/bootstrap.sh` already made. Row 10 is a check about
a simulation, and is the only one of the six that is not about a linked binary
at all.

The install half is written and has been exercised twice: both "Install LLVM 18
+ lld" steps in the `test` job are guarded by `runner.os`, so restoring the row
is one uncommented line plus those six fixes. **The hardware is no longer
something to arrange, either** — the row was iterated against by pushing to a
branch and reading `test (macos-latest)`, which is how rows 1–3 were measured
and then proved, and `fail-fast: false` is what keeps a red macOS row from
cancelling the Linux one that says whether it is the platform or the change.

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

`bootstrap` builds `self/` with the **last released** binary — the seed, and
since R6 the only compiler that exists to build it with — which is the only
thing that checks WP19's rolling freeze
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
that each `triple` is one `self/target.ts` calls canonical, and that
each `asset` is that triple with the vendor and the ABI dropped
(`x86_64-unknown-linux-gnu` → `x86_64-linux`, `aarch64-apple-darwin` →
`aarch64-darwin`). The four spellings used to live in two comments calling each
other a contract, and two of them — `aarch64-darwin` and `x86_64-darwin` — were
described as triples the compiler accepts, which it never has.

G3 asks for this on **both** operating systems, and **it gets both.** That was
not always true and the reason it reads as recent is that it is: v0.2.0
attached `x86_64-linux` and nothing else, a published release cannot grow an
asset, so the earliest any second row could appear was the next release. The
darwin pair's `attachedSince` is 0.4.0 and so is `aarch64-linux`, v0.4.0 and
v0.5.0 both carry them, and `bootstrap (aarch64-darwin)` and `bootstrap
(x86_64-darwin)` are rows this workflow runs and passes. That is worth stating
plainly because the `test` row being out has more than once been written down
as "nothing here runs on macOS", which has not been the case since 0.4.0. Two
things had to land before the second platform, and both have:

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


### The parity run, retired

`.github/workflows/parity.yml` ran `node tests/run.js --parity` nightly: every
program in the corpus through both compilers under all sixteen flag
variations, comparing exit status, stdout, stderr and every file written. It
was the corpus half of WP19 G1, and `ci.yml`'s `parity-select` and
`parity-changed` ran the same comparison on a pull request over the programs
it touched. It opened an issue when a full run was not green and closed it
when one was, because a gate that goes red where nobody looks is the silence
[§A5](wp19-stage0-retirement.md#a5-the-gate-reopened-and-the-correction-a4-needed)
records.

All three compared stage0 with stage1, so R6 deleted them with `src/`; a
comparison with one side gone has nothing left to say. What the corpus is
held to now is its goldens — `tests/cases/*.ll`, `.err` and `.stdout`, compiled
by stage1 in `npm test` — and `nish-cmp`, which compares HEAD with the last
release rather than with a second implementation.

### The toolchain on each runner

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

After the tests, the job compiles `examples/add.ts` with `build/nish`, runs
`scripts/size-report.sh --markdown`, and appends the table to the job summary
so the size of every profile (`debug`, `speed`, `size`, `wasm`) is visible on
the run page for each OS. A `concurrency` group cancels superseded runs of
the same branch.

## Where the wall clock goes

Measured on 2026-09-18, run 474 on `main` (`a89bee7`), six jobs on
`ubuntu-latest`, **before R6** — two compilers in the tree, and the
`batch-parity` job that compared them still in the workflow:

| Job | Duration | The step that is nearly all of it |
| --- | --- | --- |
| `batch-parity` | **18 m 21 s** | the corpus compiled both ways, 18 m 05 s |
| `test` | 15 m 42 s | `npm test`, 14 m 44 s |
| `runner` | 6 m 08 s | the corpus through the Nish runner, 5 m 49 s |
| `bootstrap` | 1 m 11 s | `self/` built with the seed, 51 s |
| `lint` | 10 s | — |
| `seeds` | 8 s | — |

The jobs run in parallel, so the workflow's wall clock was the longest of them:
**18 m 27 s**. `batch-parity` went with `src/`, and so did most of what made
`test` long (below); these numbers are the record of that tree, not of this
one, and want re-measuring before anyone cites them.

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
`rm -rf build/test`, and `fs.existsSync` guards drop checks with no `SKIP` line
to say so (`.claude/testing.md` has both traps); profiling from outside the
process avoids each of them. Read the expensive rows and not the cheap ones:
every `spawnSync` the suite makes blocks the event loop, so queued writes flush
in bursts and the order *within* a burst carries no timing information.

What it reported for `npm test` at `a89bee7` — 660.5 s locally, against the
runner's 14 m 44 s, so that box was about 1.34x a `ubuntu-latest`:

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

The ten of them were 70% of the run. The five that name stage0 were
comparisons with it, and R6 either deleted them or left them comparing against
recorded bytes — `tests/self/goldens/`, the `.ll` and `.err` goldens,
`nish-cmp` — rather than against a second compiler run per program.

### The one cost behind most of that list

Almost none of it was compiling Nish. `tests/batch_worker.js` measured one
stage0 run, `node dist/index.js <case>`, at about 634 ms, of which **1.5 ms**
was compiling: 36 ms was Node starting, ~473 ms was `import ts from
"typescript"`, and ~85 ms was loading `dist/`. The oracles and
`tests/diagnostic_coverage.js` could not avoid paying it, because what they
compared was what the *command line* answers, so a process per program was the
thing under test.

The workflow answered that twice while stage0 existed — `NODE_COMPILE_CACHE`
for the import, and `--batch-gate-only` so `batch-parity` stopped repeating the
`test` job's checks — and R6 answered it at the root. Every compiler process
the suite spawns now is the native stage1 binary, which imports nothing, so
the per-process cost those two measures were shaving is no longer in the
suite. `tests/batch_compile.js`, `tests/batch_worker.js` and `--batch-gate-only`
went with `src/`.

### What is still on the table

Re-measuring. Both items this section used to list — splitting the WP14
self-hosting block into a job of its own, and batching
`tests/diagnostic_coverage.js` — were priced against the stage0 process cost
above, and that cost has gone. What still stands is the accounting problem
either would have hit: `tests/run.js` has no way to run one section and *say*
it ran one section, and the substring filter is the trap described above. A
`--section` mechanism with honest skip counting is the piece of work that
unlocks splitting `test` at all, if a fresh profile says it is worth splitting.

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
bash scripts/fetch-seed.sh   # the last release's nish into build/seed/ (or set NISH_BOOTSTRAP)
npm run check           # tsc --noEmit over self/, std/ and tests/nish/
npm run build           # the seeded bootstrap: build/nish
npm test                # stage1 from the seed + tests/run.js (goldens, llvm-as, native, runtime, size, wasm)
npm run lint            # only if package.json defines it
npm run size-report     # the plain table; add --markdown via scripts/size-report.sh
```

There is no compiler to build with `tsc`: `npm run check` type-checks `self/`
against `runtime/nish.d.ts` and emits nothing, and every compiler the steps
above run is `self/`, built by the seed.

`scripts/build.sh` and `scripts/size-report.sh` branch on `uname`: on macOS
they use ld64's `-dead_strip` / `-x` instead of `--gc-sections` / `-s`, skip
`-fuse-ld=lld` and `-fno-plt`, and strip the padding macOS `wc -c` adds. The
`wasm` profile asks `clang -print-prog-name=wasm-ld` where the linker is, so a
Homebrew LLVM works even when its bin dir is not on `PATH`; when no `wasm-ld`
exists the size report omits the row and `build.sh --profile wasm` exits 2
with a message.

## Diagnostic format

Every error the compiler reports, whether from the parser or the checker, is a
`Diagnostic` (`self/diagnostics.ts`) and is printed to stderr in this shape:

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

Syntax errors from the parser (`self/parser.ts`) use the same layout with the
`syntax error:` prefix — the same `Diagnostic`, with `syntax error` as the word
before the text:

```
build/test/diag_syntax.ts:2:10: syntax error: <what the parser expected>
  2 |   return 1;
    |          ^
```

A tool that wants the parts separately — file, line, column, code, message —
reads them from `--json` rather than parsing this text.

Tests for the format live in the `// ---- WP10: diagnostics` block of
`tests/run.js`.

## Multi-error reporting

The compiler does not stop at the first error. Every phase that can recover
reports into one `DiagnosticSink` (`self/diagnostics.ts`) owned by the
`Compilation` (`self/compilation.ts`):

| Phase | Recovery unit | Where |
| --- | --- | --- |
| Parser | every parse diagnostic of the file | `parse` (`self/parser.ts`) |
| Phase 0 validator | every forbidden construct (a rejected node's subtree is skipped, so `Array<any>` is one error) | `validate` (`self/validator.ts`) |
| Pass 1 (signatures) | per declaration: class/interface (marked `poisoned`, its layout checks skipped), import, function signature, module resolution | `Checker.collectSignatures`, `Compilation.load` |
| Pass 1b/1c | per import binding; every symbol clash | `Checker.bindImports`, `Compilation.rejectSymbolClashes` |
| Pass 2 (bodies) | per statement, at the innermost statement list; the enclosing function is marked `poisoned` and its definite-return check is skipped | `checkStatements` (`self/statements.ts`) |

The language has no exceptions, so a phase reports into the sink and returns a
sentinel, and the sink is asked at the end of the phase whether to stop
(`hasErrors`). So pass 2 never runs over broken signatures, and the emitter
never sees a poisoned function. `sorted()` orders what was collected — files in
load order, then line and column, stably, so two errors at one position keep
the order the phases produced them in.

The driver prints `DiagnosticSink.format`: each error's summary and excerpt, at
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
and the code is not. The registry is `self/codes.ts`, the one copy, and it is
**kept by hand**. Adding a diagnostic is adding its entry there with the next
free number in its band; a code is never renumbered, and a retired rule keeps
its number reserved rather than handing it to another.

`scripts/gen-diagnostic-codes.mjs` generated the registry while there were two
compilers to keep in step (`src/codes.ts` and `self/codes.ts`, from the
diagnostic sites of `src/`). It is frozen now: it scans nothing and writes
nothing, and `--check`, which CI runs, validates the file's format and that
every code in it is unique. What stops a diagnostic shipping without a real
code is `tests/diagnostic_coverage.js`: every registry code has to be provoked
by a program in `tests/wordings/` or named with a reason in
`tests/wordings/unreachable.txt`.

The band says which phase refused the program:

| Band | Meaning |
| --- | --- |
| `NL0000` | no rule matched this message yet (see the backlog below) |
| `NL0001` | a syntax error; every one of them shares one code, a convention from when the text was the `typescript` package's |
| `NL0002` | the C toolchain `--link` needs could not be used (exit 3) |
| `NL0003` | an internal compiler error (exit 70) |
| `NL1xxx` | Phase 0, the forbidden-syntax sweep (`self/validator.ts`) |
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
message words of its own and then its registry entry.

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

Both write to stdout instead of IR (`self/ast_text.ts` and `self/dump.ts`);
file names are printed relative to the working directory.

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

`self/debug.ts` builds the DWARF metadata; `IRFunction` (`self/ir.ts`) carries a
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
command line, so it is reproducible across machines, and it asks nothing of
the compiler, which has no `process.cwd()` to ask with and no runtime budget to
grow one (WP14 D4). A class reached through an import is described against *its
own* `DIFile` and line numbers rather than the importing module's, which is why
there is more than one `DIFile` in a program with imports
(`tests/link/reachable_struct`).

A function's own position — the `DISubprogram`'s `line` and `scopeLine`, its
parameters' `DILocalVariable`s, and the `DILocation` the prologue and any
untied instruction carry — is where the **declaration** starts: `export`, or
`const`, or `function`. Not the arrow: the parser normalises WP22's two
spellings into one node that spans the declaration, and `FunctionSig.declSite`
is the node the checker records for it (`tests/cases/dbg_arrow`). stage0 read
the position off the arrow, whose own start is its parameter list, and named
the wrong line whenever the arrow sat below its `const`
(`docs/wp19-stage0-retirement.md` §A5); the golden is what keeps that from
coming back.

A `DILocation` column is a **byte** offset into its line, plus one — what
`clang -g` writes and what a debugger reads it back against — not UTF-16 code
units, which differ from it for every position after a non-ASCII character on
the same line (`tests/cases/dbg_utf8`). Diagnostic columns are a separate
question and are code units: the consumer there is an editor
(`self/diagnostics.ts`, `columnOf` against `byteColumnOf`).

`-g` is a flag of `self/compile.ts`, and the `dbg_*` goldens in `tests/cases/`
pin the bytes it emits, metadata numbering included.

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
