# WP12: Release engineering and production hardening

What ships in the npm package, how the CLI fails, and how to cut a release.
User-facing install instructions are in [INSTALL.md](INSTALL.md).

## The package

`package.json#files` whitelists what `npm pack` includes:

| Path | Why it ships |
| --- | --- |
| `dist/` | the compiled CLI (`dist/index.js` is the `amritc` bin) |
| `runtime/` | `runtime.c` (linked into every `--link` binary) and `amritc.h` (included by the N-API shim) |
| `scripts/` | `build.sh` (the `--link` pipeline), `bootstrap.sh` (the self-hosted compiler), `size-report.sh`, `smoke.sh`, `changelog-section.sh` |
| `README.md`, `LICENSE`, `docs/INSTALL.md` | documentation |

`package.json` is always included by npm (134 files in total at 0.1.0).
Sources, tests, examples, benchmarks, `CHANGELOG.md` (it lives on GitHub and
becomes the release notes), the other docs and CI configuration are not in
the tarball. Check with `npm pack --dry-run`.

`src/index.ts` resolves `scripts/build.sh` and `runtime/runtime.c` from the
package root (`PKG_ROOT` in `src/version.ts`, i.e. `dist/..`), never from the
working directory, so `npm install -g amritc` works from anywhere. The
`// ---- WP12: package` block of `tests/run.js` proves it: it runs `npm pack`,
installs the tarball into a temporary prefix, and links a hello-world from an
unrelated directory with the installed `amritc`.

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
| 70 | internal compiler error: any other exception escaping `main` (`EX_SOFTWARE`) | `amritc <version>: internal compiler error while compiling <inputs>`, the exception, a request to report it at the issue tracker; the stack trace only with `AMRITC_DEBUG=1` |

`--help` is the answer to a question, not a refusal, so it prints on stdout and
exits 0 — what clang, tsc and git do, and what lets a wrapper ask the compiler
what it accepts without treating the run as a failure. A usage *error* prints
the same text on stderr with exit 2. The two are told apart by the stream and
the code, and `tests/run.js` pins both. stage1 answers the same way
(`self/compile.ts`).

Under `--json` every one of these failures is also one JSON object on stdout —
including exit 3 and exit 70, which have no source position and so carry
`{"severity","code","message"}` with the band-0 codes `AS0002` and `AS0003`. A
tool that asked for JSON is never left with an empty stdout and an exit code to
guess about. See [wp10-ci.md](wp10-ci.md#failures-without-a-source-position).

The toolchain check runs *before* compilation (`missingToolchain()` probes
`$CC --version`), so a missing compiler is reported instantly, without
writing any IR. A `build.sh` failure happens *after* the IR is written and the
message names the `.ll` files so the user can build them by hand.

Every code is exercised by the `// ---- WP12: exit codes` block of
`tests/run.js`: the internal-error path through the `AMRITC_SIMULATE_ICE=1`
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

Releases are tag-driven; nothing is published from a developer machine.

1. **Bump the version** on a branch:

   ```bash
   npm version 0.2.0 --no-git-tag-version     # edits package.json + package-lock.json
   ```

2. **Update `CHANGELOG.md`**: rename `## [Unreleased]` to `## [0.2.0] - YYYY-MM-DD`,
   start a fresh empty `## [Unreleased]` above it, and update the compare
   links at the bottom. The release notes are generated from this section by
   `scripts/changelog-section.sh 0.2.0`; run it locally to preview them.

3. **Verify** the tree the tag will point at:

   ```bash
   npm run check && npm run lint && npm test && npm run smoke
   npm pack --dry-run          # only dist/, runtime/, scripts/, README.md, LICENSE, docs/INSTALL.md
   ```

4. **Merge** the branch to `main`, then **tag and push the tag**:

   ```bash
   git tag -a v0.2.0 -m "amritc 0.2.0"
   git push origin v0.2.0
   ```

5. **The `Release` workflow** (`.github/workflows/release.yml`) runs on the
   tag:
   - calls the `CI` workflow (`workflow_call`): typecheck, tests, smoke and
     size report on Ubuntu and macOS, lint;
   - refuses to continue if the tag does not equal `package.json#version`;
   - `npm ci && npm run build && npm pack`, and checks the tarball contains
     `dist/index.js`, `runtime/runtime.c`, `runtime/amritc.h` and
     `scripts/build.sh`;
   - `gh release create v0.2.0 amritc-0.2.0.tgz` with the CHANGELOG
     section as the notes.

6. **npm publish is manual** for now. When ready:

   ```bash
   git checkout v0.2.0
   npm ci && npm publish --access public      # prepublishOnly re-runs check/build/test
   ```

   To automate it, add an `NPM_TOKEN` repository secret and uncomment the
   `Publish to npm` step at the end of `release.yml` (it uses
   `NODE_AUTH_TOKEN` and `--provenance`).

If a release is wrong, delete the GitHub release and the tag, fix, and tag
again with a *new* patch version; never move a tag that CI has already built.

## Open decision: which compiler the package ships

The position this project is run on: **the compiled native binary is what
should reach a user.** `build/amritc` — stage2, the self-hosted compiler built
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
| **(b) per-platform prebuilt binaries** | `amritc-<os>-<arch>` packages declared as `optionalDependencies` with `os`/`cpu` — the esbuild pattern — with the main package resolving whichever one npm installed | a release build matrix that does not exist. `release.yml` runs one `ubuntu-latest` job and attaches one tarball; every supported triple would need its own runner and its own artefact, macOS needs an answer for both architectures, and each release publishes N+1 packages instead of one. It also needs a fallback for a platform with no binary, and that fallback is (a) |
| **(c) make stage2 the compiler, stage0 the seed** | `bin.amritc` runs the native binary; `dist/` stays, as the seed and the oracle | the four things [wp14-selfhost.md](wp14-selfhost.md) §7a lists as still stage0's, two of them user-visible: `--emit-ast` and `--target host` are refused by name rather than answered, and an internal error exits 1 through `panic` rather than 70. Until those close, (c) ships a compiler that is not the one INSTALL.md and the exit-code table above describe. It is also not a delivery mechanism on its own — the binary still arrives by (a) or (b) |

The options are not exclusive: (c) is about which binary is `amritc`, and (a)
or (b) is about how it gets onto the machine. What is not open is stage0's
role — it is the seed and the oracle in all three.

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
