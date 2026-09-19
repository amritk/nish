---
name: G5 — the installer, and which compiler it installs
overview: Make the installed `nish` run the self-hosted native binary, delivered as per-platform packages the way esbuild delivers its own, with stage0 in the same package as the universal fallback and `self/` shipped so a platform with no binary can still build one.
stages:
  - id: npm-manifest
    title: feat(release) — the package becomes a launcher, and the rows carry their npm identity
    goal: Make bin.nish a launcher that runs a per-platform native compiler when npm installed one and dist/index.js when it did not, with every per-platform package name derived from the rows in seed-targets.json rather than from a second list.
    verification: node tests/run.js wp12 and node tests/run.js seed are green at their new counts, npm test is undegraded, and deleting one row's npm fields makes the seed block exit 1 naming the row
    status: pending
    todos:
      - id: nm-rows
        content: Add npmOs and npmCpu to every row of .github/seed-targets.json — see The package becomes a launcher
        status: pending
      - id: nm-asset
        content: Export assetForTriple from src/codegen/target.ts beside hostTriple, and make the seed block read it instead of re-deriving — see The package becomes a launcher
        status: pending
      - id: nm-launcher
        content: Add bin/nish.mjs and point package.json bin at it — see The package becomes a launcher
        status: pending
      - id: nm-manifests
        content: Add scripts/npm-manifests.mjs, which writes the main package's optionalDependencies and each platform package.json from the rows — see The package becomes a launcher
        status: pending
      - id: nm-files
        content: Widen package.json files to carry bin and self, and move the WP12 block's allowed and required lists with it — see The package becomes a launcher
        status: pending
      - id: nm-optional
        content: Give the WP12 install check an omit-optional arm plus a second arm that installs a locally packed platform package — see The package becomes a launcher
        status: pending
      - id: nm-discovery
        content: Make tests/run.js discover and run every tests/npm/*.js as its own section with the counts folded in — see The package becomes a launcher
        status: pending
      - id: nm-drive
        content: Drive every arm of the launcher and of the generator from tests/npm/launcher.js and tests/npm/manifests.js — see The package becomes a launcher
        status: pending
  - id: bootstrap-fallback
    title: fix(bootstrap) — an installed package can build its own compiler
    goal: Close the sentence wp12 records against itself — that the tarball carries a bootstrap script which can never bootstrap — by shipping what it compiles and proving the bootstrap runs out of an install.
    verification: tests/npm/fallback.js packs, installs into a temporary prefix and runs scripts/bootstrap.sh --stages 1 out of that prefix, green with clang and a counted skip without it
    status: pending
    todos:
      - id: bf-guard
        content: Rewrite bootstrap.sh's self/compile.ts guard and its message, which now names a broken install rather than a missing checkout — see The fallback
        status: pending
      - id: bf-seed
        content: State in bootstrap.sh's header which seed an installed package has, and check that seed is present before the first stage — see The fallback
        status: pending
      - id: bf-test
        content: Add tests/npm/fallback.js, the pack-install-bootstrap round trip — see The fallback
        status: pending
      - id: bf-measure
        content: Measure what the fallback costs in unpacked bytes and in wall clock, for the stage that rewrites the documents to quote — see The fallback
        status: pending
  - id: publish-train
    title: ci(release) — the release publishes N+1 packages in an order a half-finished run can be re-run from
    goal: Make release.yml assemble a platform package from each binaries artifact and publish all of them before the main package, idempotently, so a run that dies part way leaves nothing a user can install and is repaired by re-running it.
    verification: tests/npm/publish.js drives .github/npm-publish.sh through each of its arms against a stand-in for npm and is green, and a run whose proving job did not succeed refuses rather than publishing
    status: pending
    todos:
      - id: pt-assemble
        content: Add the release.yml step that turns each binary artifact into a platform package directory — see Publishing N plus one
        status: pending
      - id: pt-script
        content: Add .github/npm-publish.sh, which decides per package whether this exact version is already on the registry — see Publishing N plus one
        status: pending
      - id: pt-order
        content: Publish every platform package before the main package, and stop the job rather than the release when one does not land — see Publishing N plus one
        status: pending
      - id: pt-drive
        content: Drive every arm of npm-publish.sh from tests/npm/publish.js against a stand-in for npm — see Publishing N plus one
        status: pending
  - id: installer-docs
    title: docs(wp12) — the open decision is closed, and the install line is one line
    goal: Replace wp12's open decision with the decision taken and its measured bill, and rewrite INSTALL.md and README.md around an install that is one command on four platforms and a named second path on every other.
    verification: node docs/check-links.mjs is green, node tests/run.js seed is green with every prose version claim still matching the file, and every number in the rewritten sections was measured by a stage of this plan
    status: pending
    todos:
      - id: id-decision
        content: Rewrite the wp12 section headed Open decision so it records the decision, with (c) as what nish runs and (b) over (a) as how it arrives — see The record
        status: pending
      - id: id-stale
        content: Correct the three stale measurements in that section and the four missing rows of the files table — see The record
        status: pending
      - id: id-install
        content: Rewrite INSTALL.md §2 and the README install block around the three tiers — see The record
        status: pending
      - id: id-notinwp
        content: Rewrite wp12's Not in this work package bullet, which still describes delivery as unsolved — see The record
        status: pending
---

## Context

[WP19 G5](../../docs/wp19-stage0-retirement.md#g5--distribution-does-not-need-node) has one bullet left, and since PR #121 settled the registry name it is work rather than a decision: *installing the package keeps working, and it becomes a thin installer that fetches the binary for the host, or ships it.*

Two decisions are taken and this plan implements them.

**(c) — the self-hosted native binary is what `nish` runs.** `dist/` stays, as the bootstrap seed and as the differential oracle. All four objections [`docs/wp14-selfhost.md`](../../docs/wp14-selfhost.md) §7a held against this have closed, and [`docs/wp12-release.md`](../../docs/wp12-release.md) already says so in the row itself.

**(b) as the delivery mechanism, with (a) as the fallback.** Per-platform prebuilt binaries as `optionalDependencies` carrying `os` and `cpu`, which is the esbuild pattern; `self/` shipped so a platform with no binary can build one.

**The doc's cost for (b) is stale, and that is why (b) is affordable.** It reads *"a release build matrix that does not exist. `release.yml` runs one `ubuntu-latest` job and attaches one tarball"*. Measured on this tree:

| What the doc says does not exist | Where it is |
| --- | --- |
| a per-architecture build matrix | [`release.yml:162`](../../.github/workflows/release.yml) `binaries:`, `runs-on: ${{ matrix.target.runner }}` at line 165, `fail-fast: false` at line 169 |
| the matrix's rows | line 171, `fromJSON(needs.targets.outputs.rows)`, computed at line 139 by `.github/seed-due.sh` |
| a per-target artefact | lines 232–319 — build, tarball-contents gate, smoke from an unrelated directory, upload |
| the guard against a mislabelled asset | lines 238–243, the runner's own `uname` against the row's `host` |

`acbca9f` (#114) exercised the **three** rows that had never run, on their own hardware, and all three passed; `x86_64-linux` has shipped since `attachedSince: 0.1.1`. So the only real remaining cost of (b) is the one this plan has to answer for — **publishing N+1 packages per release**.

Three other numbers in the section this plan rewrites are stale and are corrected with it — `self/` is 64 modules and 1,331,914 bytes rather than 58 and 944,676; the `files` table omits `std`, `llms.txt` and `docs/AI.md`, which the manifest already carries; and the "146 files in total at 0.1.1" count is undated.

## Approach

**There is already one mapping between npm's vocabulary and this project's targets, and it is not a new one.** [`src/codegen/target.ts:59`](../../src/codegen/target.ts) is `hostTriple(platform = process.platform, arch = process.arch)`, and it maps exactly onto the four triples in [`.github/seed-targets.json`](../../.github/seed-targets.json). The launcher therefore needs no table of its own, and the plan does not invent a second target list — which is the defect that file's own note exists to prevent.

**The per-platform package is named `@amritk/nish-<asset>`, not `@amritk/nish-<platform>-<arch>`.** esbuild spells its packages `@esbuild/linux-x64`, in npm's vocabulary. That spelling would give every platform here **two** names — `linux-x64` beside the `x86_64-linux` that `seed-targets.json` defines, `release.yml` stamps into `nish-<version>-x86_64-linux.tar.gz`, and `tests/run.js` checks against the compiler's own target table. Taking `asset` verbatim means one string per platform across the repository and the registry, and it costs one mapping in the launcher, which is `hostTriple` plus the vendor-and-ABI drop that `seed-targets.json`'s note already states as the whole rule. That drop becomes `assetForTriple` in `target.ts`, checked against all four rows, so the derivation exists once and the file is what it is checked against.

**No postinstall script.** esbuild's own install-time binary swap cannot be used here, because `tests/run.js`'s WP12 block installs with `--ignore-scripts` and an install whose correctness depends on a script npm can be told to skip is not one. The launcher resolves at run time instead, and pays a Node start for it — measured in stage 1 and quoted in stage 4.

**Silence is for the correct arm only.** No platform package resolving is a *correct* state — stage0 answers, slower, and it is the oracle every `self/` phase is compared against, so the answer is not worse, only slower. A platform package that resolves and whose binary will not run is a *broken* state and exits 3 naming the package, because falling back there would hide a bad publish behind a working compiler.

**Stage 1 owns `tests/run.js` and nothing else does.** The WP12 package block and the WP19 seed-target block both live in that file and both move, so they move together; every later stage puts its checks in `tests/npm/*.js`, which stage 1 teaches `run.js` to discover the way it already discovers `tests/cases/`.

## The package becomes a launcher

**The rows carry their npm identity.** Each of the four rows in [`.github/seed-targets.json`](../../.github/seed-targets.json) gains `npmOs` and `npmCpu` — the values npm's own `os` and `cpu` fields filter on, which are `process.platform` and `process.arch` spellings:

| asset | triple | npmOs | npmCpu |
| --- | --- | --- | --- |
| `x86_64-linux` | `x86_64-unknown-linux-gnu` | `linux` | `x64` |
| `aarch64-linux` | `aarch64-unknown-linux-gnu` | `linux` | `arm64` |
| `aarch64-darwin` | `aarch64-apple-darwin` | `darwin` | `arm64` |
| `x86_64-darwin` | `x86_64-apple-darwin` | `darwin` | `x64` |

The file's note gains a paragraph in the shape of its existing ones, saying that these two are the npm side of the same contract and that the round trip below is what keeps them honest.

The WP19 seed-target block in [`tests/run.js`](../../tests/run.js) gains three checks, each failing in both directions:

- `hostTriple(npmOs, npmCpu) === triple` for every row. That is the compiler's own table answering, so a row that invents an npm identity fails here rather than on a release day, exactly as a row inventing a triple does today.
- `assetForTriple(triple) === asset` for every row — a new export beside `hostTriple` in [`src/codegen/target.ts`](../../src/codegen/target.ts) implementing the vendor-and-ABI drop the JSON's note states. The block re-derives that rule inline today; it calls this instead, so there is one implementation and the file is what it is compared against.
- the four npm identities are distinct, and the package name each implies is distinct.

**The launcher.** `bin/nish.mjs`, and `package.json#bin.nish` points at it. Its whole job is to choose a compiler and get out of the way:

1. `NISH_NATIVE=<path>` set and runnable — run it. This is the escape hatch a user who bootstrapped their own binary uses, and it is what the fallback's instructions name.
2. otherwise `hostTriple(process.platform, process.arch)`, then `assetForTriple`, then `createRequire(import.meta.url).resolve("@amritk/nish-<asset>/bin/nish")`. Resolved and runnable — run it.
3. resolved and **not** runnable — exit 3 naming the package and the path, with the band-3 message shape. Not a fallback, for the reason in Approach.
4. not resolved — run `dist/index.js` in this package. Silent, because this arm is correct.

It runs the child with `spawnSync(bin, process.argv.slice(2), { stdio: "inherit" })` so every byte of stdout and stderr is the compiler's own — which is what keeps `--help` on stdout with exit 0, the `wrote <file>` progress line on stderr, and one flat `--json` object per diagnostic on stdout, all unchanged (orientation rule 7). It exits with the child's status, or `128 + n` for a signal, matching what `spawnSync` reports to `self/`'s own callers.

Two things it must not do, and both are checked. It must not print anything of its own on a successful run, because stdout is a contract and stderr carries a line the CLI harness reads. And it must not touch `--version`'s output: the native binary answers `nish <version>` from `self/branding.ts`'s `VERSION`, which `tests/run.js` already pins equal to `package.json#version` (line 4749), so the string is identical whichever arm answers.

**The two manifests.** `scripts/npm-manifests.mjs` reads the rows and writes both sides:

- into `package.json`, an `optionalDependencies` entry per row **due at this version** — `.github/seed-due.sh`'s answer, not the whole file — pinned to the exact version, never a range. A range would let a user's install resolve a platform package from another release.
- a `package.json` for each platform package, carrying `name`, `version`, `os: [npmOs]`, `cpu: [npmCpu]`, `license`, `repository`, and `files` of `bin`, `runtime`, `scripts`, `LICENSE`, `README.md`. No `dependencies`, no scripts.

**The platform package is the release tarball with a manifest in it.** `release.yml:247–252` already stages exactly the layout the native compiler needs — `bin/nish`, `runtime/`, `scripts/build.sh` — because `self/compile.ts:558` looks for `scripts/build.sh` in `dirname(argv[0])/..` and then in the working directory. Inside `node_modules/@amritk/nish-<asset>/`, that resolves to the platform package's own root, so the package must carry its own `runtime/` and `build.sh` and the staged directory is already that package. Nothing new is built.

**A hazard with a named remedy.** npm must preserve the executable bit on `bin/nish` through pack, publish and install. It is not in the package's `bin` field, so npm does not `chmod` it. The check for this is a pack-and-install round trip asserting mode `0755` on the installed file; if it fails, the remedy is to give the platform package `"bin": { "nish-<asset>": "bin/nish" }` — a uniquely named entry, so two packages never both provide `nish` — which forces npm to mark it executable. Decide that from the check rather than in advance.

**What the WP12 block asserts after this.** It is 11 `check()` sites and one `skip()` today, expanding to 15 assertions with clang and 10 plus a skip without. Five move, and none is relaxed:

| Assertion | What moves, and why the new behaviour is right |
| --- | --- |
| `npm pack ships only the whitelisted paths (N files)` | `allowed` gains `/^bin\//` and `/^self\//`; the count in the label moves. `self/` is now a published surface on purpose — that is the (a) fallback's whole cost — and the launcher is the `bin` |
| `npm pack includes everything --link and node --import need ...` | `required` gains `bin/nish.mjs` and `self/compile.ts`, the file `bootstrap.sh:181` guards on. A tarball missing either installs a package that cannot run or cannot bootstrap |
| — new, mirroring the `std/` check beside it | every `self/*.ts` in the tree ships, read from the tree rather than from a list, for the reason that check already gives — a list goes stale and a `files` entry narrowed later takes a module out just as quietly |
| `npm install <tarball> --prefix <tmp> succeeds` | gains `--omit=optional`. The packed manifest names platform packages at a version the registry does not have, so without it this check reaches the network and depends on the registry for its result. Omitting them is what makes the existing round trip prove what it always proved — that the tarball is self-contained |
| `installed nish --version works from an unrelated cwd`, and the three `--link` checks under it | unchanged in text. What they exercise moves from stage0 directly to the launcher's fallback arm, which is the arm a user on an unsupported platform gets, so they are now proving the fallback rather than assuming it |
| — new | a second install arm that first `npm pack`s a **locally assembled** platform package for this host and installs both tarballs into one prefix, then re-runs `--version`, `--link` and the linked binary against it. That is the arm that proves resolution, the executable bit, and stdio fidelity, and it is offline |

Both install arms are counted skips without clang, as the existing one is.

**The harness hook.** `tests/run.js` gains a block that discovers `tests/npm/*.js`, runs each as a child, and folds its `N passed, M failed, K skipped` into the run's own summary — the same shape `tests/cases/` discovery has, so a later stage adds a file and it runs without editing `run.js`. A file that exits non-zero is a failure; a file that prints no summary is a failure, not a pass.

**Owns:** `.github/seed-targets.json`, `package.json`, `package-lock.json`, `bin/**`, `src/codegen/target.ts`, `scripts/npm-manifests.mjs`, `tests/run.js`, `tests/npm/launcher.js`, `tests/npm/manifests.js`

## The fallback

[`docs/wp12-release.md`](../../docs/wp12-release.md) records the state against itself:

> `package.json#files` ships `dist/`, `runtime/` and `scripts/`, and `self/` is not on the list — so `scripts/bootstrap.sh` travels in the tarball without the source it compiles.

Stage 1 puts `self/` in `files`. This stage makes that mean something.

**`self/` ships always, in the main package, and not in a fallback package of its own.** Three reasons, in order of weight. npm has **no key for "no binary matched"** — `os` and `cpu` select a package, nothing deselects into a default — so a fallback package could only be chosen by a postinstall script, which `--ignore-scripts` disables. A separate package would double the N+1 atomicity problem for the one path that exists to be the safety net. And the bill is affordable and now measured — `self/` is 1,331,914 bytes of TypeScript across 64 modules, which is the number stage 4 quotes in place of the doc's stale 944,676.

**The script needs almost nothing.** [`scripts/bootstrap.sh`](../../scripts/bootstrap.sh) does `cd "$(dirname "$0")/.."` at line 122, so inside an install it already resolves to the package root, where `self/`, `dist/`, `runtime/` and `scripts/build.sh` now all are. The seed it defaults to is `node dist/index.js` — stage0, which the same package ships. So an installed package can genuinely run the chain.

Two edits. The guard at lines 179–184 says `run this from a checkout of the repository`, and its comment above it says the published package does not ship `self/`. Both are now wrong: reaching that guard from an install means a **broken install**, and the message should say which, naming the package root it looked in. And the header should say what an installed package's seed is, since `NISH_BOOTSTRAP` unset now has two meanings — a checkout's `dist/`, and an install's.

**`tests/npm/fallback.js`** packs, installs into a temporary prefix with `--omit=optional`, and runs `scripts/bootstrap.sh --stages 1 -o <tmp>/nish --work <tmp>/work` out of that prefix, then compiles and runs a hello-world with the result. `--stages 1` and not the default 2, because this check is about whether the chain can start from an install, not about the fixed point, which [`tests/self/bootstrap.js`](../../tests/self/bootstrap.js) proves on every run and which would double a suite already at three minutes. A counted `skip(reason)` without clang, like every other toolchain-dependent check.

Measure two things for stage 4 to quote — the unpacked size of the installed package before and after `self/`, and the wall clock of `--stages 1` on a CI-sized box. The doc's "1.5 MB to about 2.4 MB" is an estimate from before `std/` and `llms.txt` were on the whitelist.

**Owns:** `scripts/bootstrap.sh`, `tests/npm/fallback.js`

## Publishing N plus one

This is the real cost of (b) and the only one the stale paragraph got right in substance.

**The order is what makes a half-finished run safe.** Every platform package publishes first; the main package publishes last. The main package's `optionalDependencies` pin exact versions, so until it lands there is nothing on the registry that can resolve to a package that does not exist. A run that dies part way therefore leaves the registry in a state where `npm install @amritk/nish@<version>` is a 404 — a release that is not on npm — rather than one where it is a broken install. Those are not the same failure and only the second is unrecoverable.

**A re-run must be green.** `npm publish` of a version already on the registry is a 403, so a naive re-run of a partly finished release fails on the first package that landed. `.github/npm-publish.sh` takes a package directory and decides, in the shape [`.github/ddc-tag.sh`](../../.github/ddc-tag.sh) already sets for this repository:

| The run | What it does |
| --- | --- |
| this exact name and version are not on the registry | publishes with `--access public --provenance` |
| this exact name and version are on the registry, with the same tarball integrity | nothing, and green — a re-run of a release that already published is not a failure |
| this exact name and version are on the registry with **different** contents | refuses, naming both. A version that means two things is worse than a version that is missing |
| the job that proves this artefact did not succeed, or is not named | refuses, and says which — the same `DDC_PROOF` discipline, for the same reason |

`--access public` is on every one of the N+1, because all of them are scoped and a scoped package is private by default; the commented-out step at `release.yml:511` already carries it and this generalises it rather than inventing it.

**Recovery is a new patch version, never an unpublish.** That is the rule [`docs/wp12-release.md`](../../docs/wp12-release.md) already states for a wrong release, and npm's 72-hour unpublish window is not a plan. A release whose main package landed and whose platform package did not cannot happen by construction; a release where a platform package is wrong is fixed forward.

**What the workflow gains.** The `binaries` job already uploads each staged tarball. A step in the publishing job unpacks each artefact, drops in the generated `package.json` and `README.md`, and hands the directory to `npm-publish.sh`. Nothing is rebuilt and nothing is built on the wrong architecture — a tarball of a foreign binary packs fine from any runner, and the binary that goes in it was built and smoke-tested on its own hardware by the job that produced it.

Note what `prepublishOnly` does and does not cover here, because it is easy to assume it covers more. It runs on `npm publish <directory>`, not on `npm publish <tarball>`, and the existing commented step publishes the packed tarball. The platform packages have no scripts at all. So the safety net for every one of the N+1 is `ci` and `binaries`, not `prepublishOnly` — which is already true of the step as written and should be said rather than discovered.

**`tests/npm/publish.js`** drives `npm-publish.sh` through every arm above against a stand-in for `npm`, because the refusals cannot be reached in a real release without the release going wrong, and a gate nobody can fail is a wish. Include the ordering: a run where a platform package fails must not reach the main package's publish, and the test asserts the stand-in never saw that call.

**Owns:** `.github/workflows/release.yml`, `.github/npm-publish.sh`, `tests/npm/publish.js`

## The record

The section headed *Open decision: which compiler the package ships* becomes the decision, in the shape *The npm name* already takes — the decision and its date first, the bill stated rather than discovered, then the record of why left as it was written.

What it must say, and what it must stop saying:

- **(c) is taken.** `bin.nish` runs the native compiler; `dist/` stays as the seed and the oracle, which is unchanged in all three options and was never open.
- **(b) is the delivery, with (a) as the fallback.** The cost sentence for (b) is deleted and replaced with what is there — `release.yml:162`'s matrix, one runner per architecture, `fail-fast: false`, four rows in the matrix and three of them exercised on their own hardware for the first time by `acbca9f` (#114). The cost that **remains** is N+1 packages per release, and the section says how the ordering makes a part-finished run recoverable rather than leaving it as a worry.
- **The three stale numbers go.** `self/` at 64 modules and 1,331,914 bytes; the unpacked size measured by stage 2 rather than estimated; the `files` table's four missing rows (`std`, `llms.txt`, `docs/AI.md`, and the `!scripts/arrow-verify.mjs` negation, which is load-bearing and has its own check).
- **The *Not in this work package* bullet** still ends *"What is still not in any work package is delivering one through npm... and it waits on the name."* The name landed in #121 and the delivery is this plan. Rewrite it, keeping the historical first half that explains why `files` looks the way it did.

[`docs/INSTALL.md`](../../docs/INSTALL.md) §2 is rewritten around three tiers, in the order a reader meets them — `npm install -g @amritk/nish` then `nish` on the four platforms; the release tarball for someone who wants no npm at all; and, on any other platform, the same npm install plus `bash scripts/bootstrap.sh` out of the installed package, with `NISH_NATIVE` naming the result. Its §2 also says *"x86_64 Linux is the only platform built today"*, which has been false since `release.yml` grew the matrix — what is true is that only `x86_64-linux` is attached to a **published** release, and that distinction is the one `attachedSince` exists to draw.

The README's install block gets the same line, once.

Two things the prose must not disturb, because `tests/run.js` reads it: every per-platform version claim in `INSTALL.md`, `wp10-ci.md`, `wp12-release.md` and `wp19-stage0-retirement.md` is matched against `seed-targets.json` and must still match, and the phrases *the darwin pair* and *the other three* are only well-defined while those rows share an `attachedSince`, which the same block asserts. Rewriting a sentence into a new shape is allowed; rewriting a version is not.

**Owns:** `docs/wp12-release.md`, `docs/INSTALL.md`, `README.md`, `docs/wp10-ci.md`

## Out of scope

- **R6.** `src/` stays, and so does the `typescript` dependency. stage0 is the seed and the oracle in every option here, and (c) is about which binary is `nish` rather than about whether stage0 exists.
- **`docs/wp19-stage0-retirement.md`'s gate states.** Another change is in flight on that file. This plan leaves G5's row alone; the stage that closes it is a separate commit with the measurements in hand.
- **npm publish automation beyond what the delivery needs.** The `NPM_TOKEN` secret and `id-token: write` are already written down at `release.yml:506–512`; this plan generalises that one step to N+1 and does not decide when the token is created.
- **`attachedSince` for any row.** Which release attaches which seed is #92's, and it is a release rather than work.
- **Windows, and musl.** `build.sh` is bash; the linux rows are `-gnu` triples and npm's `libc` field would be the way to say so, which is a row's question rather than this plan's.
- **`STD_PREFIX`.** It stays `nish/`. The day the standard library resolves through npm it becomes `@amritk/nish/`, and [`docs/wp21-packages.md`](../../docs/wp21-packages.md) §2 is where that is decided.

## Tests

Every stage ships its check, and three of the four ship a check that can be made to fail on demand:

| Stage | The check that did not exist before |
| --- | --- |
| npm-manifest | `hostTriple(npmOs, npmCpu) === triple` and `assetForTriple(triple) === asset` over all four rows, both directions; the launcher's four arms and its exit-status and signal fidelity in `tests/npm/launcher.js`; the generated manifests against the due rows in `tests/npm/manifests.js`; the WP12 block's second install arm, against a locally packed platform package, offline |
| bootstrap-fallback | `tests/npm/fallback.js` — pack, install, `bootstrap.sh --stages 1` out of the prefix, compile and run |
| publish-train | `tests/npm/publish.js` — every arm of `npm-publish.sh` against a stand-in for npm, including the ordering assertion that the main package's publish was never reached |
| installer-docs | none of its own; it is held by the seed block's prose checks and by `node docs/check-links.mjs` |

Demonstrate the failures rather than asserting them, the way the wordings gate is demonstrated by dropping a line: delete one row's `npmCpu`, and publish a stand-in package whose contents differ from the registry's. Put both outputs in the pull request body.

No existing assertion is weakened. The five that move are named in *The package becomes a launcher* with the reason each new behaviour is the correct one, and two of the five — the `--omit=optional` arm and the platform-package arm — make the round trip prove **more** than it does today, not less.

## Verification

Per stage, on its own branch, before the pull request opens — the five conditions of [`AGENTS.md`](../../AGENTS.md#shipping-a-change-what-a-pull-request-must-be-and-who-merges-it):

```bash
npm run check                                   # tsc --noEmit over src/
npm test                                        # read the skip count, not the exit code
node tests/run.js wp12                          # 57 today; quote the new number
node tests/run.js seed                          # 38 today; quote the new number
npm run lint                                    # no worse than main
node docs/check-links.mjs                       # when the change touches Markdown
node scripts/changelog-gen.mjs --check-subject "<pr title>"
```

A `DEGRADED:` banner, or a skip that is not one of the three environmental ones — no WASI sysroot, `NISH_BOOTSTRAP` unset, no `jq` for the WP19 seed-matrix states — means the run did not prove what its summary suggests. Stage 1 and stage 2 each add a fourth environmental skip (no clang, on the new install and bootstrap arms), and each stage that adds one says so in its pull request body so the count stays readable.

Delete `build/test` before quoting any filtered count. A filtered run's number depends on what ran before it.
