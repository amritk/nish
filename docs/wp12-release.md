# WP12: Release engineering and production hardening

What ships in the npm package, how the CLI fails, and how to cut a release.
User-facing install instructions are in [INSTALL.md](INSTALL.md).

## The package

`package.json#files` whitelists what `npm pack` includes:

| Path | Why it ships |
| --- | --- |
| `bin/` | `nish`, the command, and the launcher behind it — `bin/launcher.js` and `bin/packaging.js`, plain JavaScript that needs no build step. A node shim in the tarball; the native compiler after postinstall (see "What the launcher costs") |
| `runtime/` | `runtime.c` and `runtime_os.c` (the two translation units of the C runtime, both linked into every `--link` binary) and `nish.h` (included by the N-API shim) |
| `scripts/` | `build.sh` (the `--link` pipeline), `bootstrap.sh` (the self-hosted compiler), `size-report.sh`, `smoke.sh`, `changelog-section.sh` |
| `README.md`, `LICENSE`, `docs/INSTALL.md` | documentation |

`package.json` is always included by npm (146 files in total at 0.1.1).
Sources, tests, examples, benchmarks, `CHANGELOG.md` (it lives on GitHub and
becomes the release notes), the other docs and CI configuration are not in
the tarball. Check with `npm pack --dry-run`.

`src/index.ts` resolves `scripts/build.sh` and `runtime/runtime.c` from the
package root (`PKG_ROOT` in `src/version.ts`, i.e. `dist/..`), never from the
working directory, so a global install works from any directory.

**The package is an installer.** `bin.nish` is `bin/nish`, which looks
for the prebuilt native compiler for this machine and hands over to it; the
binary arrives as one of four `@amritk/nish-<asset>` packages declared as
`optionalDependencies` with `os` and `cpu` set, so npm installs the matching
one and skips the rest. **Nothing is compiled on a user's machine on any
path** — each of those packages is the binary `release.yml` built, `--verify`d
and smoke-tested on hardware of its own architecture, repackaged from the same
staged directory the release tarball is made from, so installing is a download
and an unpack. A machine with no prebuilt binary — musl, FreeBSD, a 32-bit
anything — gets a diagnostic naming the four platforms that have one and exit
3. It used to get `dist/index.js`, the Node compiler that shipped in the same
package; that compiler is `src/`, which R6 deletes, so there is nothing left to
fall back to (see "Which compiler the package ships", amended 2026-09-22, and
[wp19 §6](wp19-stage0-retirement.md#6-what-retirement-costs-stated-plainly) for
what it costs whom).

That is one package published per release plus N platform ones, which the
`binaries` matrix produces and `release.yml` attaches. Publishing them is the
one manual step left (see "Release procedure" step 4).

**npm is not the only way in.** `install.sh` at the repository root is the
`curl | sh` route — it reads `uname`, downloads the release tarball for that
platform and unpacks it into `~/.nish` — and it needs no new build machinery,
because the tarballs it fetches are the ones `release.yml` has attached since
0.1.1. The two channels are for two different users: npm pins a compiler
version per project in a `package.json`, which is what an Nish program already
has for its own dependencies ([wp21-packages.md](wp21-packages.md)), and the
script puts one compiler on one machine with no node anywhere. `tests/run.js`
drives the script's platform mapping against every row of
`.github/seed-targets.json` rather than letting it hold a second copy of the
asset names.

Upgrading through that channel is running the script again — there is no
`nish upgrade`, and there is a reason beyond nobody having written one. The
compiler has no networking: `runtime/` has no sockets and no TLS, and it is
under a `.text` budget this document's neighbours defend, so a compiler that
downloaded its own replacement would have to grow one or shell out. The CLI
also has no subcommand grammar — `main(argv)` reads a non-flag argument as an
input file, so `nish upgrade` today asks for a file called `upgrade` — and it
would have to answer for the npm channel too, where writing into
`node_modules` is npm's business and gets undone by the next `npm ci`. So
upgrading belongs to whatever installed the compiler, which is `npm update -g`
on one side and this script on the other.

The `// ---- WP12: package` block of `tests/run.js` proves it: it runs `npm pack`,
installs the tarball into a temporary prefix, and links a hello-world from an
unrelated directory with the installed `nish` — which, with no platform package
beside it, is the fallback path end to end. It then synthesises a platform
package in that prefix and checks the other one: that `nish` hands argv to the
binary and gives its exit status back, that a binary killed by a signal reaches
the caller as that signal rather than as a status, and that a binary which will
not start falls back to the Node compiler and says so on stderr. A stub stands
in for the compiler there on purpose — what is under test is whether the
launcher gets out of the way, and whether the thing it hands to is a correct
compiler is `npm run bootstrap`'s question.

`--version` reads `version` from `package.json` at runtime
(`src/version.ts`). There is no generated version file to keep in sync.

`prepublishOnly` runs `npm run check && npm run build && npm test`, so a
`npm publish` from a broken tree fails before anything is uploaded.

## What the launcher costs

`bin/nish` ships as a node shim: it resolves the prebuilt binary and spawns it.
That is correct everywhere and it costs node's startup on every invocation.

**Measured on this tree (0.3.0, x86_64-linux, 20 runs of `--version`):**

| What is on PATH | Per invocation |
| --- | ---: |
| the native binary itself (`build/nish`) | 2.7 ms |
| the node shim, spawning that binary | 94 ms |
| the shim after `scripts/postinstall.mjs` has replaced it | 3.2 ms |

The 91 ms is node starting, not the compiler doing anything, and it is charged
once per `nish`. For a build that is noise. For this repository's own
`npm run test:nish`, which spawns a compiler per case over about 900 cases, it
is roughly 80 seconds of pure launcher.

So `scripts/postinstall.mjs` replaces `bin/nish` with a one-line `/bin/sh`
`exec` of the binary it would have spawned, and the thing npm linked into
`.bin` reaches the compiler with no node in front of it — esbuild's trick, one
indirection short of it. The three rows above are why it is worth a postinstall
at all, and the first and third agreeing to within a shell's startup is the
claim that the swap gives up nothing.

**It execs the binary where it lies rather than copying it here, and that is
not a preference.** Copying was the first attempt, it passed every check in
this file, and it breaks `--link` on every npm install. npm links the command
as `node_modules/.bin/nish -> ../@amritk/nish/bin/nish`, so a user always
invokes it through a symlink; the native compiler resolves `build.sh` and
`runtime/` from `argv[0]`'s directory and **does not follow one**. A copy at
`@amritk/nish/bin/nish` reached through `.bin` therefore looks for them in
`node_modules/` and finds neither:

```
--link: cannot find scripts/build.sh (looked in .../node_modules/.bin/.. and .)
```

`--version` and plain `-o` keep working throughout, which is what makes it a
trap rather than an outage — and it is why `tests/run.js` now invokes the
installed compiler through the `.bin` symlink and asserts *which directory* the
swapped command resolves from, rather than only that something ran.

The node shim never had this problem because node resolves `import.meta.url` to
the realpath. This is **[wp19 §5a](wp19-stage0-retirement.md#5a-what-r6-is-waiting-on)
item 4**, `packageRoot()`'s sensitivity to `argv[0]`, which that section recorded
as "unmeasured by anything": it was measured here, and this is the shape it took
in front of a user.

**That defect is fixed in the compiler as of 2026-09-21** — the real path of
whatever `argv[0]` named is a candidate for the package root, so a command
reached through `.bin` finds the package it points into — and the `exec` stays
anyway, because the three rows above are its actual reason. The swap is worth a
postinstall for the 91 ms, not for the symlink; what changes is that it is no
longer also holding a defect shut, and a `nish` that npm linked but never
swapped (`--ignore-scripts`, a read-only `node_modules`) now resolves its own
package as well.

**The shim is the mechanism and the swap is the optimisation, never the other
way round.** `npm ci --ignore-scripts` is an ordinary thing for CI to do, and a
sandbox or a proxy may disable scripts outright; each of those leaves the shim
in place, which still reaches the prebuilt compiler — at the middle row's price
rather than the bottom row's. **What the shim is not, since 0.6.0, is a compiler
of its own**: on a platform with no prebuilt binary it refuses and exits 3,
because `dist/` is no longer in the package to fall back to (see "Which compiler
the package ships"). The script therefore **exits 0 whatever happens** — no
binary for this platform, a read-only `node_modules`, a missing
`bin/packaging.js`, a half-written package — and
`tests/run.js` checks that the case it can reach (nothing to swap in) succeeds
rather than failing the install. A postinstall that can break `npm ci` would be
a worse bug than the startup cost it exists to remove.

It also refuses to run in a checkout, which is not a nicety: this repository is
its own package, so `npm ci` here installs this package's own
`optionalDependencies`, and once those are published the first `npm ci` would
otherwise overwrite the tracked `bin/nish` with a binary and leave the working
tree dirty. The guard is the presence of `self/compile.ts` — it was
`src/launcher.ts` until the launcher moved into `bin/` and started shipping,
which made it useless as a landmark — and it is now literally the same check
`scripts/bootstrap.sh` makes rather than the same shape of one.

## Exit codes and failure modes

**3 covers two things and deliberately does not split**, which is worth stating
because a wrapper cannot tell them apart by status: a C toolchain that could not
be run, and — since 0.6.0 — the prebuilt compiler itself. They are one shape of
failure, "a program that had to run would not", with no source position and
nothing wrong with the input, and the code under `--json` is `NL0002` for both.
What separates them is that object's `message`, which is why the launcher's
refusal is machine-readable rather than prose only.

| Code | When | Message shape |
| ---: | --- | --- |
| 0 | success, and `--help` / `--version`: a request that was answered | `wrote <file.ll>` / `linked <exe>: <bytes> bytes (<profile>)` on stderr; the usage text or the version line on **stdout** |
| 1 | `CompileError` from the validator, parser or checker; a driver refusal (`--link` without `export function main`, several modules with a single `-o file.ll`); a Node system error on an input or output path | `file:line:col: error: ...` with caret excerpt, or one line |
| 2 | usage *error*: unknown flag, missing argument, no inputs | `usage: ...` on stderr |
| 3 | toolchain: the C toolchain, or the prebuilt compiler itself, could not be run. `--link` requested but `clang` (or `$CC`) is not runnable; `scripts/build.sh` exited non-zero or could not be spawned; or `bin/nish` found no prebuilt compiler for this platform, or one that would not start | the per-platform install hint; build.sh's stderr verbatim followed by `--link: <build.sh> failed (exit N); the IR is in ...`; or the launcher's refusal naming the platforms a release carries |
| 70 | internal compiler error: any other exception escaping `main` (`EX_SOFTWARE`) | `nish <version>: internal compiler error while compiling <inputs>`, the exception, a request to report it at the issue tracker; the stack trace only with `NISH_DEBUG=1` |

`--help` is the answer to a question, not a refusal, so it prints on stdout and
exits 0 — what clang, tsc and git do, and what lets a wrapper ask the compiler
what it accepts without treating the run as a failure. A usage *error* prints
the same text on stderr with exit 2. The two are told apart by the stream and
the code, and `tests/run.js` pins both. stage1 answers the same way
(`self/compile.ts`).

Under `--json` every one of these failures is also one JSON object on stdout —
including exit 3 and exit 70, which have no source position and so carry
`{"severity","code","message"}` with the band-0 codes `NL0002` and `NL0003`. A
tool that asked for JSON is never left with an empty stdout and an exit code to
guess about. See [wp10-ci.md](wp10-ci.md#failures-without-a-source-position).

The toolchain check runs *before* compilation (`missingToolchain()` probes
`$CC --version`), so a missing compiler is reported instantly, without
writing any IR. A `build.sh` failure happens *after* the IR is written and the
message names the `.ll` files so the user can build them by hand.

Every code is exercised by the `// ---- WP12: exit codes` block of
`tests/run.js`: the internal-error path through the `NISH_SIMULATE_ICE=1`
test hook (which throws a `TypeError` at the top of the compile step and
exists only for that test), the missing-toolchain path by running with `PATH`
set to an empty directory, and the build failure path with `CC` pointing at a
stub compiler that accepts `--version` but fails to link.

## Smoke test

`npm run smoke` (`scripts/smoke.sh`) builds every `examples/**/*.ts` that
declares `export function main` with `--link --profile size`, runs it, and
prints a table:

```
PROGRAM                       BYTES  STATUS
examples/hello.ts              4392  ok (exit 0)
examples/multi/main.ts         4360  ok (exit 49)
smoke: 2 program(s) built (size profile) and ran
```

A program is expected to exit 0 unless it carries a `// smoke: exit <n>`
comment. Any build, link, or unexpected-exit failure makes the script exit 1
(3 when clang is missing). CI runs it right after `npm test` on both
operating systems, so the table for each is in the job log.

## What the release tarball carries, and the four releases that carried too little

The staged directory `release.yml`'s `binaries` job builds is what both
channels ship: the tarball is `tar -czf` over it and the npm platform package
is `npm pack` over the same directory. It holds `bin/nish`, `runtime/`,
`scripts/build.sh`, `std/`, `LICENSE` and `INSTALL.md`.

`std/` joined that list on **2026-09-20**, and every release from 0.1.1 to
0.4.0 went without it. The compiler in those tarballs links `hello.ts` and
answers any program that imports the standard library by its package
specifier with

```
error: Module `nish/text` is not part of the standard library (it has: json, testing, text)
```

which names the module it is refusing, because the list in that sentence is
the static table of module names and the **file** is what is missing. The
compiler resolves a `nish/<module>` specifier against its own package root,
so that form — and only that form — depends on what the tarball staged; a
relative import resolves against the program and works with no `std/` shipped
at all, which is why the corpus noticed on exactly two programs.

It was found by `nish-cmp` on its first run in CI
([wp19 §5a](wp19-stage0-retirement.md#5a-what-r6-is-waiting-on), work item 1),
and confirmed against the published v0.4.0 asset: copying `std/` into the
unpacked tarball makes that same binary compile, link and run the program, so
the omission is the whole cause and staging it is the whole fix.

**Nothing had been published to npm when it was found**, so the fix lands
before the first publish rather than after it. The release tarballs are a
different matter: a release already published cannot grow a file, so 0.1.1
through 0.4.0 keep the defect, and `cmpSince` in `.github/seed-targets.json` is
what stops `nish-cmp` comparing against a seed that has it.

Three guards existed and none covered it — the staging copied `runtime` and
not `std`, the "the tarball carries a whole compiler" presence check listed
seven paths and none under `std/`, and both smoke programs import nothing. All
three are fixed, and the third is the one that matters most: the smoke step
now compiles **and runs** a program that imports `nish/text`, because a list is
a claim about names and only running one of those modules says the library is
whole.

`release.yml` has **three** presence gates, one per artefact — the release
tarball, the per-platform npm package and the main npm package — and all three
name every standard-library module now. The first two were missing it; the
third carried `std` through `package.json`'s `files` all along, with nothing
asserting it. `tests/run.js` derives the list from the same
directory `self/std_modules.ts`'s literal and stage0's directory read are
already checked against, and fails when any of the three gates omits a module —
so the next module added to the library cannot ship in the compiler's list and
not in the tarball. Each check was watched failing.

## The lockfile's copy of the platform pins, and how it went stale

`release-pr.yml` bumps the version in `package.json`, in `package-lock.json`
(both of its copies), in `self/branding.ts`, and across the
`optionalDependencies` entries that pin the per-platform compiler packages —
which have to move with the version, or a release installs a compiler that
resolves the *previous* release's binaries.

It moved three of those four. The bump read `optionalDependencies` off the top
of each file, and a lockfile does not keep the root package's dependencies
there: they live under `packages[""]`. So `package.json` moved and the lockfile
did not, and **v0.4.0 shipped with `package.json` pinning `0.4.0` and
`package-lock.json` still pinning `0.3.0`**.

Nothing was red, which is the part worth keeping. `npm ci` tolerates the
disagreement, and `npm install` simply rewrites the file under whoever runs it
next — so the drift repaired itself in every working tree and stayed in the
commit. The check that existed for exactly this read `bumped.optionalDependencies`,
the same top-level spelling the buggy code read: **a check that looks where the
code looks cannot see the code looking in the wrong place.**

Both are fixed. The bump walks both locations, the test that drives it asserts
the pins in *both files*, and a standing check compares `package.json`'s pins
against the lockfile's on every run — so a future drift from any other cause is
caught where this one was not. Each was watched failing: the strengthened bump
test goes red against the old script, and the standing check goes red against
the lockfile v0.4.0 actually shipped.

## Release procedure

Releases ride a train; nothing is published from a developer machine, and no
step below is done by hand.

1. **Merge pull requests as usual.** Every merge to `main` runs
   `.github/workflows/release-pr.yml`, which walks the commits since the last
   tag, computes the next version from their types, and opens or refreshes one
   open **`chore(release): <version>`** pull request carrying the version bump
   (`package.json`, `package-lock.json` and `self/branding.ts`, which must
   agree or `tests/run.js` fails), `changelog/<version>.json`, and the
   `CHANGELOG.md` section rendered from it.

   The title is a conventional commit because it *is* one: the squash merge
   makes it the subject of the commit that lands on `main`, so `pr-title.yml`
   checks it like any other and the generator files it under "Internal" in the
   next release rather than skipping it.

   Only conventional subjects become entries. The notes are the account of
   what a release changed, and the commits behind a merge -- the
   work-in-progress whose landed subject already has an entry -- are not that
   account; before the filter they were 171 of the 175 commits in the first
   release and roughly 97% of the rendered file. Every skipped subject is
   named on stderr, so nothing goes missing quietly, and
   `--include-unconventional` restores the old behaviour for a release that
   wants the raw history. Prose that belongs above the sections goes in
   `changelog/<version>.intro.md`.

   The rendered section is an index: one line per change -- the scope, the
   subject, and a link to the pull request it landed in (or to the commit,
   when it landed without one). The commit bodies, the `Measured:` numbers and
   the refs stay in the JSON, which is what the website renders an entry from;
   inlining them turned a release into pages of prose above the next heading,
   and the pull request is already where the rest is.

   The notes are therefore reviewable *before* anyone can read them, in the
   pull request whose body is those notes. To fix a wording, edit the JSON on
   that branch: `CHANGELOG.md` is rendered from it and editing it directly is
   overwritten on the next merge.

   Opening that pull request needs one repository switch: **Settings > Actions
   > General > Workflow permissions > "Allow GitHub Actions to create and
   approve pull requests"**. GitHub refuses `gh pr create` from a workflow
   without it, whatever the workflow's `permissions:` block says, and no token
   in the `permissions:` block can grant it. A `RELEASE_PR_TOKEN` secret (a PAT
   or app token carrying `repo`) lifts it too, and the workflow prefers it when
   it exists. With neither, the train still pushes the `release/next` branch
   with everything on it and the job warns with the link that opens the pull
   request by hand -- the release is one click rather than blocked, and `main`
   stays green.

2. **Merge the Release pull request.** That is the act of releasing. The same
   workflow sees `changelog/<version>.json` present and `v<version>` absent,
   creates the tag, and then **dispatches `release.yml` at it**.

   The dispatch is not belt and braces; it is the only thing that starts the
   release. GitHub raises no event for a ref pushed with the default
   `GITHUB_TOKEN` — its loop guard, with no exemption for ref creation — so
   `release.yml`'s `push: tags` trigger never sees a tag this workflow pushed.
   **v0.1.0 is what that looks like: tagged, never built, no release.** The two
   events `GITHUB_TOKEN` *may* raise are `workflow_dispatch` and
   `repository_dispatch`, so the train uses the first and needs no PAT. The
   `push` trigger stays for a tag pushed by a human, whose credentials do start
   a workflow — which is also how a tag stranded by this bug is recovered.

3. **The `Release` workflow** (`.github/workflows/release.yml`) runs on the
   tag, whether it was dispatched there or a human pushed it:
   - calls the `CI` workflow (`workflow_call`): typecheck, tests, smoke and
     size report on Ubuntu, the bootstrap-from-the-last-release job, lint;
   - refuses to continue unless the ref is a tag and equals
     `package.json#version` — the ref type first, because a dispatch can be
     aimed at any ref and a run started on `main` would otherwise report a
     version mismatch rather than the mis-aimed run it is;
   - `npm ci && npm pack`, and checks the tarball contains `bin/nish`,
     `bin/launcher.js`, `bin/packaging.js`, `runtime/runtime.c`,
     `runtime/nish.h`, `scripts/build.sh` and every `std/` module. No
     `npm run build` before it since 0.6.0: nothing in the tarball is `tsc`
     output;
   - runs the `binaries` matrix — one job per supported target, each on a
     runner of that architecture (`ubuntu-latest`, `ubuntu-24.04-arm`,
     `macos-15-intel`, `macos-latest`) — which bootstraps the native compiler
     to `build/release/nish-0.2.0-<triple>` with `--verify` and then
     smoke-tests it: `--version`, and linking and running `examples/hello.ts`
     from a directory unrelated to both the checkout and the unpack. Each job
     checks its runner's own `uname` against the triple it was asked for, so
     an asset cannot be labelled for an architecture it was not built on;
   - cuts this release's **provenance tag**, `ddc-<version>`, at the commit
     being released — after the jobs above have proved the property it stands
     for and before anything is published (`.github/ddc-tag.sh`, and "The
     provenance tag" below);
   - `gh release create v0.2.0 nish-0.2.0.tgz` plus the four
     `nish-0.2.0-<triple>.tar.gz`, with the notes rendered from
     `changelog/0.2.0.json` — the file the release pull request was reviewed
     with, not a fresh walk of the log, so what is published is what somebody
     approved. A body over 120,000 characters is cut at a paragraph and points
     at the JSON; an empty one fails the job rather than shipping a blank
     release.

   Nothing is cross-compiled, because the chain is a chain: `bootstrap.sh`
   runs stage1 to build stage2, and a stage1 for another architecture does not
   run on the builder. So "built" and "smoke-tested" mean the same thing on
   every row — there is no tier that was produced for a machine nobody ran it
   on. The release job `needs` the whole matrix, so one broken target stops the
   release rather than publishing three binaries of four: the missing one is
   the seed some later `bootstrap` run will look for.

   The binaries are not only a convenience for people without Node: each is
   the **seed** its own platform's rolling-freeze check bootstraps from, which
   is why each is verified and smoke-tested before it ships and why the names
   are fixed. Those names are not written here, and not in either workflow:
   `release.yml`'s matrix, its asset list and `ci.yml`'s `seeds` job all read
   `.github/seed-targets.json`, where each platform carries the canonical
   triple it is, the asset name derived from that triple by dropping the vendor
   and the ABI, the runner label that provides it, and the version from which
   a release attaches it. A release that does not attach a seed already **due**
   turns `seeds` red, because a release that exists and carries no seed for a
   platform it was supposed to carry one for is a regression rather than a
   state of the world
   ([wp10-ci.md](wp10-ci.md#the-seeded-build-and-what-a-missing-seed-reports)).
   A repository with no release at all is the other case, and there the check
   has no rows rather than failing: red would be a release train that can never
   leave, since `release.yml`'s `release` job is `needs: ci`.

   "Due" is a version comparison — `attachedSince` in that file, against the
   release being asked about, in `.github/seed-due.sh` — and not a boolean,
   for a reason worth writing down because the boolean shipped first and was
   wrong. `attached: true` says *the workflow builds this today*; `seeds` needs
   *that release carried this*, and a release is a past event which cannot grow
   an asset. So the commit that taught `release.yml` to build the darwin pair
   could not also mark them attached: v0.2.0 does not carry them, `seeds` would
   go red, and the `release` job is `needs: ci` — the release that would carry
   them could not be cut, and the flag could not be cleared until it was. A
   version dates the claim, so the workflow change and the file change land
   together and each release is judged against what it was due to attach.

4. **npm publish is manual, and is now blocked on nothing but a person.** The
   name was settled on 2026-09-19 (`@amritk/nish`, see "The npm name" below)
   and the installer landed on 2026-09-20, so both of the things this step
   used to wait on are done. It is **N+1 packages**, and the order matters:

   ```bash
   git checkout v0.4.0
   npm ci && npm run build
   # the platform packages first, then the one that depends on them
   while IFS= read -r pkg; do npm publish "$pkg" --provenance --access public; done \
     < build/release/packages.txt
   npm publish --access public                # prepublishOnly re-runs check/build/test
   ```

   **Platform packages first.** In this order a failure half way leaves a
   registry where the main package does not yet exist for that version, so
   nobody can install one whose binaries are missing; the other order publishes
   a compiler that resolves nothing and falls back to Node on every machine
   that installs it until the loop is finished. That is the partial-publish
   failure mode the decision below priced, and the ordering is the whole of the
   answer to it.

   To automate it, add an `NPM_TOKEN` repository secret and uncomment the
   `Publish to npm` step at the end of `release.yml` (it uses
   `NODE_AUTH_TOKEN` and `--provenance`, and carries the same loop in the same
   order). It stays commented until somebody turns it on deliberately: a
   publish cannot be taken back after 72 hours, and this one is N+1 packages
   rather than one. `--access public` is not optional now that the name is
   scoped: a scoped package is private by default and a private publish on a
   free account fails at the registry rather than in the workflow.

   Until a publish happens the release is the distribution, and it already
   works: `release.yml` attaches the npm tarball, the four seed tarballs *and*
   the four platform packages to every release, so `npm install -g` over the
   pair for your machine installs exactly what `npm publish` would have
   uploaded ([INSTALL.md](INSTALL.md), §2).

If a release is wrong, delete the GitHub release and the tag, fix, and tag
again with a *new* patch version; never move a tag that CI has already built.
The `ddc-<version>` tag that release cut stays where it is and should: it names
a commit at which `IR(stage0, self/) == IR(stage1, self/)` held, which is still
true of that commit whether or not the release it was cut during was published.
Cutting the next one is the next release's job, and `.github/ddc-tag.sh` refuses
to move an existing one rather than quietly repointing it.

To preview what the train would produce, without pushing anything:

```bash
npm run changelog -- --next             # the version the commits imply
npm run changelog -- --version 0.2.0    # those notes, on stdout
npm run check && npm run lint && npm test && npm run smoke
npm pack --dry-run   # only bin/, runtime/, scripts/, std/, README.md, LICENSE, llms.txt, docs/
```

## The bootstrap seed

**`nish` 0.N is built by the last patch release of 0.(N−1).** The seed is a
released binary one minor version back, never the working tree, and the whole
0.N line — 0.N.0 and every patch after it — is built by that same seed.
`scripts/bootstrap.sh` selects it with `NISH_BOOTSTRAP`, and CI's `bootstrap`
job passes the last release, which is what enforces the rule rather than hoping
for it ([wp19-stage0-retirement.md](wp19-stage0-retirement.md) §3, G3). Go
publishes a rule of the same shape; the reason to write ours down now is that a
policy decided in the abstract costs nobody an argument during a release.

**What that job checks is that the seed can build `self/`.** stage1 compiling
and linking is the rule above enforced; `self/` reaching for something the seed
does not have fails there and nowhere else. `--verify` then asserts the two
equalities that belong to the working tree rather than to the seed —
`IR(stage1) == IR(stage2)`, the fixed point, and stage3 byte-identical to
stage2. It does **not** assert `IR(seed) == IR(stage1)` for a released seed: a
release is allowed to emit better code than the release before it, and that
comparison forbids it. The seeded run reports the difference and carries on.
The one seed that comparison is asserted for is stage0, where it is two
independent implementations of one revision agreeing rather than one
implementation at two dates (G3, "What the seeded run proves, and what it does
not").

0.1.0 is the base case the rule needs. It is the first release and has no
predecessor to be built by, so it is built by stage0, and it is the release
that creates the first seed. From 0.2.0 on the seed is the previous line's last
patch release.

The consequence for contributors: **a construct added in 0.N cannot be used by
`self/` until 0.(N+1)**. While 0.N is in development the compiler that has to
compile `self/` is a 0.(N−1) binary, and it has never heard of the construct.
Rule 1 of [wp14-selfhost.md](wp14-selfhost.md) §6 — a construct enters the
language before it enters `self/` — therefore survives stage0's retirement
unchanged, and only its subject changes, from stage0 to the seed. Add the
construct to the language, ship the release, then use it in `self/`.

## The provenance tag

Every release cuts `ddc-<version>` at the commit it is built from, and no
release step asks anyone to remember it.

The tag is [WP19 G6](wp19-stage0-retirement.md#g6--the-provenance-is-recorded-before-it-is-lost)'s:
it marks a commit at which `IR(stage0, self/) == IR(stage1, self/)` and the
fixed point both hold — two independently written implementations of this
language emitting identical IR for every module of `self/`, which is the second
half of diverse double-compiling and which no other self-hosted compiler in
that document's table asserts. G6 writes down how to re-verify it from the tag:
check the tag out, `npm ci`, `npm run build`, `node tests/self/bootstrap.js`.
After R6 deletes `src/` there is no second implementation left to disagree
with, so the tags cut before that day are the only commits the property can
ever be demonstrated at again.

That is why it is cut by the workflow rather than by a person. The cost of
forgetting is paid once and is not recoverable: the first release nobody
remembers is the release after which the property can no longer be
demonstrated, and a gate that is remembered at every release except one is not
a gate. So `release.yml` has a `ddc` job between the binaries and the release,
and `.github/ddc-tag.sh` is what decides:

| The run | What it does |
| --- | --- |
| the proving jobs are green and no `ddc` tag exists for this version | cuts the tag at the released commit and pushes it |
| the tag is already there, on that commit | nothing, and green — a re-run of a release that already recorded its provenance is not a failure |
| the tag is already there, on another commit | refuses: two commits cannot both be this version's, and a provenance tag that moved is worth less than none |
| a job that proves the property did not succeed, or is no longer named | refuses, and says which job — a tag cut on a run that proved nothing is a claim nobody can falsify afterwards, which is worse than no tag |

What proves the property is not that script and must not become it:
`tests/self/bootstrap.js`, which `npm test` runs in the `ci` job, and
`scripts/bootstrap.sh --verify` with stage0 as the seed, which every row of the
`binaries` job runs — the stage0 seed is the one for which `IR(seed) ==
IR(stage1)` is asserted rather than reported ("The bootstrap seed" above). The
script reads what those jobs answered, through `DDC_PROOF`, and decides.

Each of those rows is a case in the WP19 block of `tests/run.js`, driven
against a stand-in for `git`, because the refusal cannot be reached in a real
release without the release going wrong and a gate nobody can fail is a wish.

## The npm name

**Decided 2026-09-19: the package is `@amritk/nish`, and the command stays
`nish`.** That is option (a) below, taken without the project rename option (b)
would have carried. `package.json#name` is the scoped name; `bin.nish` is
untouched, so [`self/branding.ts`](../self/branding.ts) — the file the whole
compiler reads its name from (then one of two, with stage0's copy) — does not
move, and nothing a user reads in a diagnostic changes.

Verified free on the day it was taken, with the command below pointed at the
scoped name: `https://registry.npmjs.org/@amritk%2Fnish` answered 404.

What it costs, stated rather than discovered later:

- **`npm publish` needs `--access public`**, every time, because a scoped
  package is private by default and a private publish on a free account fails
  at the registry rather than in the workflow. The commented-out publish step at
  the end of `release.yml` already carries the flag; that is the whole of the
  mitigation, and it is already written down.
- **The install line and the command line are two different strings** —
  `npm install -g @amritk/nish`, then `nish`. Every README has to say so once.
- **`npm pack` names the tarball `amritk-nish-<version>.tgz`**, not
  `nish-<version>.tgz`. Measured, not assumed: the `Release` workflow's asset
  name follows it, and nothing else does — `.github/seed-matrix.sh` and
  `.github/seed-due.sh` key on the native `*.tar.gz` rows and never on the npm
  tarball, so the bootstrap matrix is unaffected. `node tests/run.js wp12`
  (57 passed) and `seed` (38 passed) are green across the rename.
- **`STD_PREFIX` stays `nish/`** and is now deliberately *not* a spelling of
  `package.json#name`, which its own comment in both branding files used to
  claim. No name that is available could have kept that identity, since the
  identity needed the bare `nish`. It costs nothing while the standard library
  is resolved by the compiler rather than by npm; the day a third-party package
  is consumed through npm resolution ([wp21-packages.md](wp21-packages.md) §2),
  `nish/text` would resolve against somebody else's package and the prefix has
  to become `@amritk/nish/`. That is a WP21 decision, recorded here so it is not
  discovered there.

One check moved with the decision. `tests/nish/cli.ts` read the expected tool
name out of `package.json#name`, which was right only while the package and the
command were one string; it reads `bin`'s key now, which is what "the tool the
user typed" always meant.

The rest of this section is the record of why, and is left as it was written.

---

`npm install -g nish` does not install this compiler and never has. The name
`nish` on the public registry belongs to somebody else and has since 2014:

| | |
| --- | --- |
| Package | `nish` — "A Node.js Interactive shell." |
| Maintainer | `stdarg` (Edmond Meinfelder) |
| Versions | `0.0.0` (2014-02-16) and `0.0.1` (2014-02-20), and nothing since |
| Deprecated | both versions, by the author, with the message `It was a bad idea` |
| Last registry change | 2022-06-21 |

Verify it rather than trusting this table, because the registry can change
under it:

```bash
curl -s https://registry.npmjs.org/nish | node -p \
  "const j = JSON.parse(require('fs').readFileSync(0, 'utf8')); \
   [j.description, j.maintainers.map((m) => m.name).join(), Object.keys(j.versions).join(), j.time.modified].join(' | ')"
```

**Which name to take instead is not decided here.** The name reaches
`package.json#name`, `bin.nish`, every install line in `README.md` and
[INSTALL.md](INSTALL.md), the `Publish to npm` step at the end of
`release.yml`, and — if the decision changes the *binary's* name rather than
only the package's — `src/branding.ts` and `self/branding.ts`, the two files
the whole compiler reads its name from. The options, and what each costs:

| | What it means | What it costs |
| --- | --- | --- |
| **(a) a scope**, such as `@amritk/nish` | `package.json#name` becomes the scoped name and `bin.nish` is untouched, so the command a user types is still `nish` | available immediately, uncontestable afterwards, and no rename reaches the compiler. But `npm publish` needs `--access public` on every publish, because a scoped package is private by default and a private publish on a free account fails at the registry rather than in the workflow. The name in the install line and the name on the command line stop being one string, which is one more thing every README has to explain |
| **(b) a different bare name** | a free name on the registry, and the project renames with it if the binary is to match | one search and it is settled, with no scope to explain and no dispute to wait on. The cost is where the name lives: `src/branding.ts` and `self/branding.ts` spell it for every diagnostic, the runtime's `nish_*` C symbols are ABI and a rename deliberately does not follow them ([ARCHITECTURE.md](ARCHITECTURE.md#where-the-name-lives)), and `NISH_DEBUG`, `NISH_BOOTSTRAP`, the release asset names and the goldens that record the `--version` line all carry it. Renaming the *package* is cheap; renaming the *project* is not |
| **(c) npm's dispute process** | npm's package-name dispute policy covers this shape exactly — a name held by a package nobody maintains — and it begins by contacting the owner | slow, and its outcome is npm's to decide rather than ours: it is the only option here that can still fail after the waiting. The courteous first move is the same one it starts with anyway, which is to ask the author directly. Worth opening *in parallel* with (a), never instead of it |

(a) is reversible into (b) or (c) and neither of the others is reversible into
it; that ordering is the only thing this note claimed, and it is why (a) was
taken. **`package.json#name` is `@amritk/nish` as of 2026-09-19.** `npm publish`
still has not been run, and as of 2026-09-20 the reason is no longer a missing
piece of work: the next section's decision was made, the installer that carries
it is written and tested, and what is left is a person running the publish (see
"Release procedure" step 4). The scope also decides the platform packages'
names, which are `@amritk/nish-<asset>` — derived from this one rather than
written out, so the scope is still spelled in a single place.

## Which compiler the package ships

**Decided 2026-09-19: (c) for which binary, (b) for delivery, (a) as the
fallback.** `bin.nish` runs the self-hosted native compiler. `dist/` stays in
the package and keeps both of the jobs it already has — the bootstrap seed
every stage starts from, and the differential oracle every phase of `self/` is
compared against — and stops being the thing a user runs. The binary reaches
the machine as per-platform prebuilt packages, the (b) row below, and a
platform with no binary of its own falls back to (a). The three rows were never
alternatives: (c) says which binary is `nish`, (b) says how it arrives, and (a)
is what (b) does when it has nothing to hand over.

**Amended again 2026-09-22: there is no fallback at all.** (c) and (b) still
stand and are still what landed. The third row is now empty: a platform with no
prebuilt binary gets a diagnostic naming the four that have one, and exit 3.

The reason is not a re-pricing — the 2026-09-20 amendment below is arithmetic
and it is still correct — it is that the thing it priced stopped existing.
`dist/` was the cheap fallback because it was *already in the package for its
own reasons*: the bootstrap seed and the differential oracle. R6 deletes `src/`
([wp19](wp19-stage0-retirement.md)), so `dist/` has no other reasons, and
keeping it for the fallback alone would mean shipping — and therefore
maintaining, and therefore keeping buildable — a second implementation of the
compiler for musl, FreeBSD and 32-bit anything. That is the doubling wp19 §1
spent its whole length pricing, bought back at the end for the smallest
constituency in the table.

So the honest answer is the one the launcher gives. **What it costs is real and
is stated rather than discovered**: musl, FreeBSD and 32-bit platforms lose
their `npm install` route to a compiler, and it is priced in
[wp19 §6](wp19-stage0-retirement.md#6-what-retirement-costs-stated-plainly)
beside the rest of R6's costs.
[INSTALL.md](INSTALL.md) says what is left for them — a glibc host or container
to bootstrap in, `--profile wasi`, or a target this project does build — and
says plainly that none of the three is a supported install.

Two things this does *not* change, because both were the point of (b):
**nothing is compiled on a user's machine on any path**, and a supported
platform still gets its compiler as a download and an unpack. What a user on an
unsupported platform gets is a sentence instead of a slow compiler, and the
reason the sentence is worth writing down is that the alternative was a command
that exits 0 having done nothing.

The 2026-09-20 amendment, which this one supersedes and which is left standing
because its arithmetic is what made `dist/` the answer for two releases:

**Amended 2026-09-20, when the installer was written: the fallback is `dist/`,
not (a).** (c) and (b) are unchanged and are what landed. What did not survive
contact with the work is the third row, and the reason is that (a) was chosen
as "what (b) does when it has nothing to hand over" without anybody pricing
that sentence against the alternative sitting in the same tarball.

(a) costs a user a clang and two compilations of `self/` before they have a
compiler, and costs every tarball on every platform the 944,676 bytes of
`self/` — all of it to serve musl, FreeBSD and 32-bit anything, which is who is
left once `x86_64`/`aarch64` × `linux`/`darwin` is covered. `dist/` is already
in the package for its own reasons, runs anywhere node does, needs no C
toolchain, and is the same compiler by every test in this repository. It is
slower to compile *with* and free to install; (a) is faster to compile with and
expensive for everyone, including the overwhelming majority who never reach it.

The sentence this amends is **"`dist/` stops being the thing a user runs"**, and
it still holds where it was aimed: `dist/` is not what a user on a supported
platform runs, and `bin.nish` is the native binary there. "Not the default" and
"never, on any platform, even when there is no binary" are two claims, and the
row below only ever argued the first. So `files` does not list `self/`, and the
one thing (a) would have bought — a native compiler on an unsupported
platform — is not bought at all, deliberately: a working compiler is, and
nothing is compiled on a user's machine on any path.

Two of the reasons this stayed open are gone, and one of them went stale
without anybody editing it, which is worth naming.

**(c) has no objection left.** All four of the things
[wp14-selfhost.md](wp14-selfhost.md) §7a listed as still stage0's have closed —
`--target host` and `--emit-ast` are answered, `-o <dir>` is stated, and an
internal error exits 70 with its own report. What remains for (c) is
[wp19-stage0-retirement.md](wp19-stage0-retirement.md)'s later gates — the seed
protocol, oracle succession, distribution — rather than anything about the
compiler's own surface. The row below already recorded that; what it did not do
is draw the conclusion.

**(b)'s recorded cost is false, and it was the reason (b) was ruled out.** The
row below prices (b) at "a release build matrix that does not exist.
`release.yml` runs one `ubuntu-latest` job and attaches one tarball". Neither
half is true today. `release.yml`'s `binaries` job is
`runs-on: ${{ matrix.target.runner }}` (line 165) over
`target: ${{ fromJSON(needs.targets.outputs.rows) }}` (line 171) with
`fail-fast: false` (line 169) — one runner per target architecture, nothing
cross-compiled, and the rows are `.github/seed-targets.json`'s answer rather
than a list the workflow spells. The `release` job attaches the npm tarball
*and* every asset the matrix produced, from one `assets.txt` the attach and the
check share. And the rows are not theoretical: `acbca9f` (#114, 2026-09-19)
exercised the three rows `.github/seed-targets.json` marks
`attachedSince: 0.4.0` — `aarch64-linux`, `aarch64-darwin`, `x86_64-darwin` —
on the hardware each row names, and all three pass. The fourth row,
`x86_64-linux`, is `attachedSince: 0.1.1` and needed no exercising: this job
has built and attached it at every release since, `v0.1.1` through `v0.3.0`.

Nothing edited that cost into being wrong. It was true when it was written, the
matrix was then built for the seed protocol's sake rather than for this
decision, #114 proved the rows, and the sentence went stale where it stood
while still reading like a measurement. That is the failure this document's
neighbourhood is about, and this row is an instance of it rather than an
exception to it.

What (b) honestly costs, now that its blocker is built:

- **N+1 packages published per release** instead of one — the main package and
  one `nish-<os>-<arch>` per attached target — so the publish step becomes a
  loop over the same `seed-targets.json` rows, and a partially published
  release is a new failure mode to answer for.
- **A fallback for a platform with no binary.** Recorded here as (a), and
  amended above on 2026-09-20 to `dist/` — the Node compiler already in the
  package — for what (a) costs everyone to serve the few who would reach it.
  The point this bullet was making stands either way: (b) needs *a* fallback,
  which is why the row was never ruled out.

**The rule: `bin.nish` is the native binary, `dist/` is the seed and the
oracle, and a cost in the table below is re-measured before it is cited
again.**

**Implemented on 2026-09-20**, which is what the first amendment above came out
of. `bin.nish` is the launcher — `dist/launcher.js` then, `bin/launcher.js`
since 0.6.0, because a command may not be a build artifact of the compiler it
installs; `package.json` declares one
`@amritk/nish-<asset>` per row of `.github/seed-targets.json` as an
`optionalDependencies` entry pinned to its own version;
`scripts/platform-package.mjs` turns the directory `release.yml` already stages
for the release tarball into one of those packages, so the binary a user
downloads is the binary that job built and smoke-tested rather than a copy of
it; and the WP12 block drives both paths. `files` does not list `self/`, for the
reason the amendment gives. What is left of G5 is a person publishing, which is
"Release procedure" step 4 and not work.

The rest of this section is the record of why, and is left as it was written —
including (b)'s stale cost, which is the point.

---

The position this project is run on: **the compiled native binary is what
should reach a user.** `build/nish` — stage2, the self-hosted compiler built
by the compiler stage0 built — compiles the same programs about eight times
faster than the Node one and needs no Node at all
([wp14-selfhost.md](wp14-selfhost.md) §4, D5). That does not retire stage0 and
cannot: it is the bootstrap seed every stage starts from, and it is the
differential oracle every phase of `self/` is compared against
(`tests/self/`). Its job is to build the binary and to keep it honest, not to
be the thing installed.

The package does neither cleanly today. `package.json#files` ships `dist/`,
`runtime/` and `scripts/`, and `self/` is not on the list — so
`scripts/bootstrap.sh` travels in the tarball without the source it compiles.
It checks for `self/compile.ts` before anything else and exits 3 with `run this
from a checkout of the repository`, which means an installed package carries a
bootstrap script that can never bootstrap. That is not a fault in the script:
the guard exists so the failure names the missing file instead of happening
inside the compiler. It is the packaging decision showing through.

Three ways to close it, and what each costs:

| | What ships | What it costs |
| --- | --- | --- |
| **(a) ship `self/`** | the 58 modules of the self-hosted compiler, 944,676 bytes of TypeScript, so an installed package can run `scripts/bootstrap.sh` | the user builds the compiler: clang on `PATH`, and `self/` compiled twice for the default stage2 (three times under `--verify`). The unpacked package grows from 1.5 MB to about 2.4 MB, and `self/` becomes a published surface rather than a checkout-only one |
| **(b) per-platform prebuilt binaries** | `nish-<os>-<arch>` packages declared as `optionalDependencies` with `os`/`cpu` — the esbuild pattern — with the main package resolving whichever one npm installed | a release build matrix that does not exist. `release.yml` runs one `ubuntu-latest` job and attaches one tarball; every supported triple would need its own runner and its own artefact, macOS needs an answer for both architectures, and each release publishes N+1 packages instead of one. It also needs a fallback for a platform with no binary, and that fallback is (a) |
| **(c) make stage2 the compiler, stage0 the seed** | `bin.nish` runs the native binary; `dist/` stays, as the seed and the oracle | **all four of the things [wp14-selfhost.md](wp14-selfhost.md) §7a listed as still stage0's have since closed** — `--target host` and `--emit-ast` are answered, `-o <dir>` is stated, and an internal error exits 70 with its own report — so the objection this row recorded no longer stands, and what remains for (c) is [wp19-stage0-retirement.md](wp19-stage0-retirement.md)'s later gates (the seed protocol, oracle succession, distribution) rather than the compiler's own surface. It is also not a delivery mechanism on its own — the binary still arrives by (a) or (b) |

The options are not exclusive: (c) is about which binary is `nish`, and (a)
or (b) is about how it gets onto the machine. What is not open is stage0's
role — it is the oracle in all three, and the seed in all three until the
policy above hands that job to the previous release.

Nothing here has been implemented, and this note is deliberately not a plan:
`package.json` is unchanged, and the numbers above are what a decision would
cost rather than what one did.

## Not in this work package

- Windows native support (`build.sh` is bash; WSL is documented instead).
- Prebuilt binaries of the compiler itself: it is a Node program, and the
  tarball is the release artefact. **Superseded, and now in fact reversed.**
  That was true when WP12 shipped and it is why `files` looks the way it does;
  the compiler is no longer only a Node program, and `release.yml` attaches a
  prebuilt binary for each of `x86_64`/`aarch64` × `linux`/`darwin` — from the
  release each one's `attachedSince` names — 0.1.1 for `x86_64-linux`, and
  0.4.0 for the other three. Those three waited on a run that exercised their
  rows, and the darwin pair additionally on the ld64 fixed point; `acbca9f`
  (#114) ran all three on their own hardware on 2026-09-19 and settled the
  Mach-O comparison, so what they wait on now is a release that carries the
  assets rather than any work
  ([wp10-ci.md](wp10-ci.md#ci-matrix))
  ([wp19 G5](wp19-stage0-retirement.md#g5--distribution-does-not-need-node)).
  *Delivering* one through npm is option (b) of "which compiler the package
  ships" above, and it landed on 2026-09-20: the package is a launcher, the
  binary arrives as an `optionalDependencies` entry per platform, and nothing
  is compiled on a user's machine on any path. So the last unfinished thing in
  this bullet is done, and what remains of G5 is a person publishing rather
  than any work. The bullet stays because it is the position the package was
  built under. What no longer reflects it is the `files` whitelist: it lists
  neither `self/` nor a binary *nor `dist/`*, which is what (b) with no
  fallback at all looks like — the compiler is in the platform packages and the
  tarball is the launcher (amended 2026-09-22, above).

Multi-error reporting and `--json` diagnostics were listed here as a WP10
follow-up and have since landed in WP10 itself: every phase that can recover
hands its errors to one `DiagnosticSink` and the driver prints the first 20 in
source order, and `--json` writes one object per error on stdout
(`docs/wp10-ci.md`, "Multi-error reporting" and "`--json`"). stage1 answers
`--json` itself (`self/compile.ts`), as it does every other flag it owns.
