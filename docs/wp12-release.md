# WP12: Release engineering and production hardening

**Status:** complete, and the process below is the one in use. Releases are cut
by the train in `.github/workflows/release-pr.yml` and built and published by
`.github/workflows/release.yml`; npm publishing has been automatic since 0.11.0 (#205); 0.10.0, the first version
on the registry, was published by hand.
User-facing install instructions are in [INSTALL.md](INSTALL.md).

## The package

`@amritk/nish` is an installer, not a compiler. `package.json#files` ships
`bin/` (`bin/nish`, `bin/launcher.js`, `bin/packaging.js`: plain JavaScript,
no build step), `runtime/`, `scripts/` minus the repository-only tools,
`std/`, `README.md`, `LICENSE`, `llms.txt`, `docs/AI.md` and
`docs/INSTALL.md`. `npm pack --dry-run` lists it.

`bin/nish` finds the prebuilt native compiler for this machine and hands over
to it. The binary arrives as one of four `@amritk/nish-<asset>` packages
declared as `optionalDependencies` with `os` and `cpu` set, so npm installs
the matching one. **Nothing is compiled on a user's machine on any path**:
each platform package is the binary `release.yml` built, `--verify`d and
smoke-tested on hardware of its own architecture, packed by
`scripts/platform-package.mjs` from the same staged directory as the release
tarball. A machine with no prebuilt binary (musl, FreeBSD, 32-bit) gets a
diagnostic naming the four supported platforms and exit 3.

The compiler finds `scripts/build.sh`, `runtime/` and `std/` from its package
root (`packageRootCandidates` in `src/compile.ts`): the directory above the one
`argv[0]` names, then the same for its real path, and the working directory
last, only when the compiler's own real path lies inside it (CLI-2,
[docs/security/](security/README.md)), so `--link` never runs a stranger's
`scripts/build.sh`.

`install.sh` at the repository root is the second channel: it reads `uname`,
downloads the release tarball for that platform and unpacks it into `~/.nish`,
with no Node anywhere. `tests/run.js` drives its platform mapping against
every row of `.github/seed-targets.json`. There is no `nish upgrade`: the
compiler has no networking and the CLI no subcommand for it, so upgrading
belongs to whatever installed it (`npm update -g`, or the script again).

`--version` prints `VERSION` from `src/branding.ts`, baked into the binary;
`tests/run.js` fails when it disagrees with `package.json`, and
`release-pr.yml` bumps both. `prepublishOnly` runs `npm run check && npm test`.

The `// ---- WP12: package` block of `tests/run.js` packs the tarball, installs
it into a temporary prefix, checks that with no platform package the installed
`nish` refuses with exit 3 (one `NL0002` object under `--json`), then installs
a platform package built from this checkout's compiler and links and runs a
program from an unrelated directory. A stub binary checks that the launcher
passes argv through, returns the exit status, re-raises a signal, and refuses a
binary that will not start.

## What the launcher costs

Measured at 0.3.0 on x86_64-linux, 20 runs of `--version`:

| What is on PATH | Per invocation |
| --- | ---: |
| the native binary itself (`build/nish`) | 2.7 ms |
| the node shim, spawning that binary | 94 ms |
| the shim after `scripts/postinstall.mjs` has replaced it | 3.2 ms |

So `scripts/postinstall.mjs` replaces `bin/nish` with a one-line `/bin/sh`
`exec` of the binary. It execs the binary where it lies rather than copying it:
npm reaches the command through the `node_modules/.bin` symlink, and a copy
reached that way looked for `scripts/build.sh` in `node_modules/` and broke
`--link` on every install. The compiler now also adds the real path of
`argv[0]` to its package-root candidates (2026-09-21), so an unswapped shim
resolves too, and `tests/run.js` invokes the installed command through `.bin`
and asserts which directory it resolves from.

The shim is the mechanism and the swap the optimisation. `--ignore-scripts`
leaves the shim, which still works at the middle row's price. The postinstall
**exits 0 whatever happens**, because a postinstall that can break `npm ci` is
worse than the startup cost, and it does nothing in a checkout (the landmark is
`src/compile.ts`, the check `scripts/bootstrap.sh` makes).

## Exit codes and failure modes

| Code | When | Message shape |
| ---: | --- | --- |
| 0 | success, and `--help` / `--version` | `wrote <file.ll>` / `linked <exe>: <bytes> bytes (<profile>)` on stderr; the usage text or the version on **stdout** |
| 1 | a diagnostic from the parser, validator or checker; a driver refusal (`--link` without `main`, several modules with a single `-o file.ll`); an unreadable input or unwritable output | `file:line:col: error: ...` with caret excerpt, or one line |
| 2 | usage *error*: unknown flag, missing argument, no inputs | `usage: ...` on stderr |
| 3 | a program that had to run would not: no `scripts/build.sh` beside the compiler; `build.sh` (or the `clang` / `$CC` it runs) failed or could not be spawned; or `bin/nish` found no prebuilt compiler for this platform, or one that would not start | `--link: cannot find scripts/build.sh (looked in ...)`; build.sh's stderr then `--link: <build.sh> failed (exit N); the IR is in ...`; or the launcher's refusal naming the supported platforms |
| 70 | internal compiler error (`EX_SOFTWARE`, `src/ice.ts`) | `nish <version>: internal compiler error`, what broke, and a request to report it with the input and command line |

`--help` answers a question, so it prints on stdout and exits 0; a usage error
prints the same text on stderr with exit 2. All three causes of exit 3 are one
`NL0002` object under `--json`, told apart by `message`. Every failure,
including exit 3 and 70, is one JSON object on stdout under `--json`
([wp10-ci.md](wp10-ci.md#failures-without-a-source-position)). `build.sh` runs
after the IR is written, so a toolchain failure names the `.ll` files to build
by hand. `nish run` uses the same bands until the program starts and returns
the program's own status after that.

The `// ---- WP12: exit codes` block of `tests/run.js` exercises each code: the
internal error through the `NISH_SIMULATE_ICE=1` test hook, a missing toolchain
with an empty `PATH`, and a build failure with `CC` pointing at a stub.

## Smoke test

`npm run smoke` (`scripts/smoke.sh`) builds every `examples/**/*.ts` that
declares `export const main` with `--link --profile size`, runs it, and prints
a size table. A program must exit 0 unless it carries `// smoke: exit <n>`.
CI's `test` job runs it after `npm test` with `NISH=build/nish`.
`release.yml` separately smoke-tests each unpacked tarball: `--version`, then
linking and running `hello.ts` and a program that imports `nish/text`, from a
directory unrelated to both the checkout and the unpack.

## What the release tarball carries

The staged directory `release.yml`'s `binaries` job builds is what both
channels ship: `bin/nish` (stage2), `runtime/`, `scripts/build.sh`, `std/`,
`LICENSE` and `INSTALL.md`. `std/` joined it on 2026-09-20; every release from
0.1.1 to 0.4.0 lacks it, so their compilers refuse any `import ... from
"nish/<module>"`. `nish-cmp` found that on its first run, and it is why
`cmpSince` in `.github/seed-targets.json` skips those seeds. `release.yml` has
three presence gates — the tarball, the platform package and the main
package — and `tests/run.js` checks that each names every standard-library
module.

## The lockfile's copy of the platform pins

`release-pr.yml` bumps the version in `package.json`, both copies in
`package-lock.json`, `src/branding.ts`, and the `optionalDependencies` pins in
both `package.json` and the lockfile's `packages[""]`. v0.4.0 shipped with the
lockfile still pinning 0.3.0, because the bump and its test both read only the
top-level field; both now walk both places, and a standing check compares the
two files on every run. The platform packages' own lockfile entries (their
`resolved` URL and `integrity`) cannot exist until they are published, so
`release.yml`'s `lockfile` job opens a pull request with the regenerated
lockfile after the publish, and CI's `lint` job checks `npm ls
--package-lock-only` everywhere except on the Release PR and on a tag.

## Release procedure

Releases ride a train; nothing is published from a developer machine.

1. **Merge pull requests as usual.** Every merge to `main` runs
   `release-pr.yml`, which computes the next version from the conventional
   commits since the last tag and opens or refreshes one
   **`chore(release): <version>`** pull request on `release/next`, carrying the
   version bump, `changelog/<version>.json` and the `CHANGELOG.md` section
   rendered from it. A `feat` moves the minor and anything else the patch;
   before 1.0 a break also moves the minor. Only conventional subjects become
   entries, and each skipped subject is named on stderr. The notes are
   reviewed, and corrected in the JSON on that branch, before anyone can read
   them. `scripts/changelog-gen.mjs` also honours a `Release-As: X.Y.Z`
   trailer, which can only raise the version; the project stays on 0.x until
   its owner says otherwise and does not use it (`CLAUDE.md`).
   `scripts/changelog-gen.test.mjs` pins the version rules.

   Opening the pull request needs **Settings > Actions > General > Workflow
   permissions > "Allow GitHub Actions to create and approve pull requests"**,
   or a `RELEASE_PR_TOKEN` secret. Without either the branch is still pushed
   and the job warns with a link to open the pull request by hand.

2. **Merge the Release pull request.** That is the act of releasing, and it is
   a human's decision. The workflow sees `changelog/<version>.json` without a
   `v<version>` tag, creates the tag and **dispatches `release.yml` at it**.
   The dispatch is what starts the release: a tag pushed with the default
   `GITHUB_TOKEN` raises no `push` event, which is why `v0.1.0` was tagged and
   never built. `release.yml` keeps its `push: tags` trigger for a tag a human
   pushes.

3. **`release.yml`** runs on the tag:
   - `ci` calls `ci.yml` through `workflow_call`;
   - `targets` refuses anything but a tag equal to `package.json#version`, then
     asks `.github/seed-due.sh` which assets this version is due to carry;
   - `binaries` is a matrix over that answer, one job per target on a runner
     of its own architecture, with nothing cross-compiled: it checks the
     runner's `uname` against the row's `host`, fetches the previous release
     for that platform as the seed, runs `scripts/bootstrap.sh --verify`,
     stages and tars the result, smoke-tests the unpacked tarball, and packs
     the platform package;
   - `release` checks every due asset is present, runs `npm pack` and checks
     the tarball's contents, renders the notes from `changelog/<version>.json`
     (cut at 120,000 characters, refused if empty), and creates the GitHub
     release with the npm tarball, the native tarballs, the platform packages
     and one `SHA256SUMS`. It `needs` the whole matrix, so one broken target
     stops the release rather than publishing three binaries of four.

4. **`npm`** publishes by npm's trusted publishing, platform packages first and
   the main package last, so a half-finished publish never leaves an
   installable main package whose binaries are missing. There is no token:
   each package trusts `release.yml` in `amritk/nish`, the job is the only one
   holding `id-token: write`, it runs no `npm ci`, and every version carries a
   provenance attestation. It publishes the tarballs downloaded back from the
   GitHub release, with `--access public` because a scoped package is private
   by default. A failed publish is fixed by re-running the job, which skips
   versions already on the registry. A package for a newly added platform must
   be published by hand once before trust can be set on it; the job names the
   two commands. `lockfile` then opens the lockfile pull request.

If a release is wrong, delete the GitHub release and the tag, fix, and release
a *new* patch version; never move a tag CI has already built. To preview the
train locally:

```bash
npm run changelog -- --next             # the version the commits imply
npm run changelog -- --version 0.2.0    # those notes, on stdout
npm pack --dry-run
```

## The bootstrap seed

**`src/` is built by the last released `nish`.** The seed is always a release,
never the working tree: `scripts/fetch-seed.sh` puts the newest release for
this platform in `build/seed/`, `NISH_BOOTSTRAP` names another binary, and
`scripts/bootstrap.sh` has no fallback when neither exists. CI's `bootstrap`
job builds `src/` with the newest release on every platform that release
carries a seed for, and each `binaries` row builds the new release from the
previous one.

The consequence: **a construct added in 0.N cannot be used by `src/` until
0.(N+1)**, the first release that understands it. This is rule 1 of
[wp14-selfhost.md](wp14-selfhost.md) §6 with its subject moved from stage0 to
the seed. `--verify` asserts `IR(stage1) == IR(stage2)` and stage3
byte-identical to stage2, and only reports `IR(seed) == IR(stage1)`, because a
release may emit better code than the one before it. 0.1.0 was the base case,
built by stage0; every later release is built by its predecessor.

## The provenance tag

From WP19 G6 until R6 each release also cut `ddc-<version>`, marking a commit
where stage0 and stage1 emitted identical IR for every module of `src/` (the
diverse-double-compiling half of the argument). R6 deleted stage0, so the
`ddc` job went with it. The tags already cut are never moved or deleted: they
are the only commits at which that property can be demonstrated again
([wp19-stage0-retirement.md](wp19-stage0-retirement.md), G6).

## The npm name

**Decided 2026-09-19: the package is `@amritk/nish`, and the command stays
`nish`.** The bare name `nish` has belonged since 2014 to an unrelated,
deprecated "Node.js Interactive shell" by `stdarg`. A scope was chosen over a
different bare name, which would have meant renaming the project (the name is
spelled in `src/branding.ts`, environment variables, asset names and
goldens), and over npm's dispute process, which is slow and can still fail.
The scope is reversible into either; neither is reversible into it.

What it costs:

- every publish needs `--access public`;
- the install line (`npm install -g @amritk/nish`) and the command (`nish`) are
  two strings, and `tests/nish/cli.ts` reads the tool name from `bin`'s key
  rather than from `package.json#name`;
- `npm pack` names the tarball `amritk-nish-<version>.tgz`, and the platform
  packages are `@amritk/nish-<asset>`, both derived from `package.json#name`
  rather than spelled;
- the standard-library prefix `STD_PREFIX` stays `nish/` and is deliberately
  not a spelling of the package name. If third-party packages are ever
  resolved through npm ([wp21-packages.md](wp21-packages.md) §2), that prefix
  has to become `@amritk/nish/`.

## Which compiler the package ships

**Decided 2026-09-19, amended 2026-09-20 and 2026-09-22.** `bin.nish` runs the
self-hosted native compiler, delivered as per-platform prebuilt packages (the
esbuild pattern), with **no fallback**. The options priced were (a) shipping
`src/` so the user builds the compiler (clang required, two or three
compilations, about 0.9 MB more per tarball), (b) per-platform prebuilt
binaries, and (c) making the native binary `nish` with stage0 kept as seed and
oracle. They were never exclusive: (c) chose the binary, (b) its delivery.

The fallback for an unsupported platform was first (a), then — because it was
already in the package as the seed and oracle — stage0's `dist/`. R6 deleted
stage0, which left `dist/` no reason to ship but the fallback, and keeping a
second implementation buildable for musl, FreeBSD and 32-bit hosts alone was
the doubling WP19 set out to remove. Since 0.6.0 those platforms get exit 3
and a sentence; [INSTALL.md](INSTALL.md) lists what is left for them, and
[wp19-stage0-retirement.md](wp19-stage0-retirement.md) §6 prices it.

One lesson from this section's history is kept because it still applies: (b)
was first ruled out on a cost — "`release.yml` runs one `ubuntu-latest` job
and attaches one tarball" — that went stale where it stood while the release
matrix was built for the seed protocol. A cost recorded here is re-measured
before it is cited again.

## Not in this work package

- Windows native support (`build.sh` is bash; WSL is documented instead).
- Prebuilt binaries of the compiler were out of scope when WP12 shipped, while
  the compiler was a Node program. That is **reversed**: `release.yml` attaches
  a prebuilt binary for each of `x86_64`/`aarch64` × `linux`/`darwin` from the
  release each one's `attachedSince` names — 0.1.1 for `x86_64-linux`, and
  0.4.0 for the other three. `aarch64-linux` waited for 0.4.0 only on a run
  exercising its rows, and the darwin pair from 0.4.0 also on the ld64 fixed
  point ([wp10-ci.md](wp10-ci.md#ci-matrix)).

Multi-error reporting and `--json` were listed here as follow-ups and landed
in WP10 ([wp10-ci.md](wp10-ci.md), "Multi-error reporting" and "`--json`").
