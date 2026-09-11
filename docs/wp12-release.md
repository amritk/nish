# WP12: Release engineering and production hardening

What ships in the npm package, how the CLI fails, and how to cut a release.
User-facing install instructions are in [INSTALL.md](INSTALL.md).

## The package

`package.json#files` whitelists what `npm pack` includes:

| Path | Why it ships |
| --- | --- |
| `dist/` | the compiled CLI (`dist/index.js` is the `nish` bin) |
| `runtime/` | `runtime.c` (linked into every `--link` binary) and `nish.h` (included by the N-API shim) |
| `scripts/` | `build.sh` (the `--link` pipeline), `bootstrap.sh` (the self-hosted compiler), `size-report.sh`, `smoke.sh`, `changelog-section.sh` |
| `README.md`, `LICENSE`, `docs/INSTALL.md` | documentation |

`package.json` is always included by npm (134 files in total at 0.1.0).
Sources, tests, examples, benchmarks, `CHANGELOG.md` (it lives on GitHub and
becomes the release notes), the other docs and CI configuration are not in
the tarball. Check with `npm pack --dry-run`.

`src/index.ts` resolves `scripts/build.sh` and `runtime/runtime.c` from the
package root (`PKG_ROOT` in `src/version.ts`, i.e. `dist/..`), never from the
working directory, so `npm install -g nish` works from anywhere. The
`// ---- WP12: package` block of `tests/run.js` proves it: it runs `npm pack`,
installs the tarball into a temporary prefix, and links a hello-world from an
unrelated directory with the installed `nish`.

`--version` reads `version` from `package.json` at runtime
(`src/version.ts`). There is no generated version file to keep in sync.

`prepublishOnly` runs `npm run check && npm run build && npm test`, so a
`npm publish` from a broken tree fails before anything is uploaded.

## Exit codes and failure modes

| Code | When | Message shape |
| ---: | --- | --- |
| 0 | success, and `--help` / `--version`: a request that was answered | `wrote <file.ll>` / `linked <exe>: <bytes> bytes (<profile>)` on stderr; the usage text or the version line on **stdout** |
| 1 | `CompileError` from the validator, parser or checker; a driver refusal (`--link` without `export function main`, several modules with a single `-o file.ll`); a Node system error on an input or output path | `file:line:col: error: ...` with caret excerpt, or one line |
| 2 | usage *error*: unknown flag, missing argument, no inputs | `usage: ...` on stderr |
| 3 | toolchain: `--link` requested but `clang` (or `$CC`) is not runnable; or `scripts/build.sh` exited non-zero / could not be spawned | the per-platform install hint; or build.sh's stderr verbatim followed by `--link: <build.sh> failed (exit N); the IR is in ...` |
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
   and creates the tag.

3. **The `Release` workflow** (`.github/workflows/release.yml`) runs on the
   tag:
   - calls the `CI` workflow (`workflow_call`): typecheck, tests, smoke and
     size report on Ubuntu, the bootstrap-from-the-last-release job, lint;
   - refuses to continue if the tag does not equal `package.json#version`;
   - `npm ci && npm run build && npm pack`, and checks the tarball contains
     `dist/index.js`, `runtime/runtime.c`, `runtime/nish.h` and
     `scripts/build.sh`;
   - bootstraps the native compiler to
     `build/release/nish-0.2.0-x86_64-linux` with `--verify`, then smoke-tests
     it: `--version`, and linking and running `examples/hello.ts`;
   - `gh release create v0.2.0 nish-0.2.0.tgz nish-0.2.0-x86_64-linux.tar.gz`
     with the notes rendered from `changelog/0.2.0.json` — the file the
     release pull request was reviewed with, not a fresh walk of the log, so
     what is published is what somebody approved. A body over 120,000
     characters is cut at a paragraph and points at the JSON; an empty one
     fails the job rather than shipping a blank release.

   The binary is not only a convenience for people without Node: it is the
   **seed** the next release is built from, which is why it is verified and
   smoke-tested before it ships and why its name is fixed. `ci.yml`'s
   `bootstrap` job downloads exactly `nish-<version>-x86_64-linux` from the
   latest release, so renaming the asset breaks the freeze check rather than
   the release.

4. **npm publish is manual** for now. When ready:

   ```bash
   git checkout v0.2.0
   npm ci && npm publish --access public      # prepublishOnly re-runs check/build/test
   ```

   To automate it, add an `NPM_TOKEN` repository secret and uncomment the
   `Publish to npm` step at the end of `release.yml` (it uses
   `NODE_AUTH_TOKEN` and `--provenance`).

If a release is wrong, delete the GitHub release and the tag, fix, and tag
again with a *new* patch version; never move a tag that CI has already built.

To preview what the train would produce, without pushing anything:

```bash
npm run changelog -- --next             # the version the commits imply
npm run changelog -- --version 0.2.0    # those notes, on stdout
npm run check && npm run lint && npm test && npm run smoke
npm pack --dry-run   # only dist/, runtime/, scripts/, README.md, LICENSE, docs/INSTALL.md
```

## The bootstrap seed

**`nish` 0.N is built by the last patch release of 0.(N−1).** The seed is a
released binary one minor version back, never the working tree, and the whole
0.N line — 0.N.0 and every patch after it — is built by that same seed.
`scripts/bootstrap.sh` selects it with `NISH_BOOTSTRAP`, and CI's bootstrap job
passes the last release, which is what enforces the rule rather than hoping for
it ([wp19-stage0-retirement.md](wp19-stage0-retirement.md) §3, G3). Go
publishes a rule of the same shape; the reason to write ours down now is that a
policy decided in the abstract costs nobody an argument during a release.

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

## Open decision: which compiler the package ships

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
| **(a) ship `self/`** | the 54 modules of the self-hosted compiler, 791,835 bytes of TypeScript, so an installed package can run `scripts/bootstrap.sh` | the user builds the compiler: clang on `PATH`, and `self/` compiled twice for the default stage2 (three times under `--verify`). The unpacked package grows from 1.3 MB to about 2.1 MB, and `self/` becomes a published surface rather than a checkout-only one |
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
  tarball is the release artefact. **Superseded** by the decision above: that
  was true when WP12 shipped and it is why `files` looks the way it does, but
  the compiler is no longer only a Node program. The bullet stays because it is
  the position the package was built under.

Multi-error reporting and `--json` diagnostics were listed here as a WP10
follow-up and have since landed in WP10 itself: every phase that can recover
hands its errors to one `DiagnosticSink` and the driver prints the first 20 in
source order, and `--json` writes one object per error on stdout
(`docs/wp10-ci.md`, "Multi-error reporting" and "`--json`"). stage1 answers
`--json` itself (`self/compile.ts`), as it does every other flag it owns.
