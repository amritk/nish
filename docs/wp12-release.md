# WP12: Release engineering and production hardening

What ships in the npm package, how the CLI fails, and how to cut a release.
User-facing install instructions are in [INSTALL.md](INSTALL.md).

## The package

`package.json#files` whitelists what `npm pack` includes:

| Path | Why it ships |
| --- | --- |
| `dist/` | the compiled CLI (`dist/index.js` is the `nish` bin) |
| `runtime/` | `runtime.c` and `runtime_os.c` (the two translation units of the C runtime, both linked into every `--link` binary) and `nish.h` (included by the N-API shim) |
| `scripts/` | `build.sh` (the `--link` pipeline), `bootstrap.sh` (the self-hosted compiler), `size-report.sh`, `smoke.sh`, `changelog-section.sh` |
| `README.md`, `LICENSE`, `docs/INSTALL.md` | documentation |

`package.json` is always included by npm (146 files in total at 0.1.1).
Sources, tests, examples, benchmarks, `CHANGELOG.md` (it lives on GitHub and
becomes the release notes), the other docs and CI configuration are not in
the tarball. Check with `npm pack --dry-run`.

`src/index.ts` resolves `scripts/build.sh` and `runtime/runtime.c` from the
package root (`PKG_ROOT` in `src/version.ts`, i.e. `dist/..`), never from the
working directory, so a global install works from any directory — today
`npm install -g ./nish-<version>.tgz` from the release, because the registry
name is not ours (see "Open decision: the npm name is taken"). The
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
   - `npm ci && npm run build && npm pack`, and checks the tarball contains
     `dist/index.js`, `runtime/runtime.c`, `runtime/nish.h` and
     `scripts/build.sh`;
   - runs the `binaries` matrix — one job per supported target, each on a
     runner of that architecture (`ubuntu-latest`, `ubuntu-24.04-arm`,
     `macos-15-intel`, `macos-latest`) — which bootstraps the native compiler
     to `build/release/nish-0.2.0-<triple>` with `--verify` and then
     smoke-tests it: `--version`, and linking and running `examples/hello.ts`
     from a directory unrelated to both the checkout and the unpack. Each job
     checks its runner's own `uname` against the triple it was asked for, so
     an asset cannot be labelled for an architecture it was not built on;
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

4. **npm publish is manual, and is blocked on the name.** `nish` on the
   public registry is somebody else's package — see "Open decision: the npm
   name is taken" below — so there is nothing to publish under that name yet
   and the recipe here is written against whichever name that decision lands
   on. Settle the name first; then releasing to the registry is

   ```bash
   git checkout v0.2.0
   npm ci && npm publish --access public      # prepublishOnly re-runs check/build/test
   ```

   To automate it, add an `NPM_TOKEN` repository secret and uncomment the
   `Publish to npm` step at the end of `release.yml` (it uses
   `NODE_AUTH_TOKEN` and `--provenance`). `--access public` stays on that
   command line whichever name wins, because a scoped package is private by
   default and a private publish on a free account fails at the registry
   rather than in the workflow.

   Until the name is settled the release is the distribution, and it already
   works: `release.yml` attaches `nish-<version>.tgz` to every release, and
   `npm install -g ./nish-<version>.tgz` installs exactly what `npm publish`
   would have uploaded ([INSTALL.md](INSTALL.md), §2).

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

## Open decision: the npm name is taken

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
it; that ordering is the only thing this note claims. Nothing has been chosen,
`package.json#name` is still `nish`, and that is why `npm publish` has not been
run and why step 4 of the release procedure says so.

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
  release each one's `attachedSince` names, which is 0.1.1 for `x86_64-linux`
  and 0.3.0 for the other three, because v0.2.0 was published before this
  landed and a release already published cannot grow an asset
  ([wp19 G5](wp19-stage0-retirement.md#g5--distribution-does-not-need-node)).
  What is still not in any work package is *delivering* one through npm: that
  is option (b) of "which compiler the package ships" above, and it waits on
  the name. The bullet stays because it is the position the package was built
  under, and because the `files` whitelist still reflects it.

Multi-error reporting and `--json` diagnostics were listed here as a WP10
follow-up and have since landed in WP10 itself: every phase that can recover
hands its errors to one `DiagnosticSink` and the driver prints the first 20 in
source order, and `--json` writes one object per error on stdout
(`docs/wp10-ci.md`, "Multi-error reporting" and "`--json`"). stage1 answers
`--json` itself (`self/compile.ts`), as it does every other flag it owns.
