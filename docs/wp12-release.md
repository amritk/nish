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

`package.json` is always included by npm (135 files in total at 0.1.0).
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
| 0 | success | `wrote <file.ll>` / `linked <exe>: <bytes> bytes (<profile>)` on stderr |
| 1 | `CompileError` from the validator, parser or checker; a driver refusal (`--link` without `export function main`, several modules with a single `-o file.ll`); a Node system error on an input or output path | `file:line:col: error: ...` with caret excerpt, or one line |
| 2 | usage: unknown flag, missing argument, no inputs, `--help` | `usage: ...` |
| 3 | toolchain: `--link` requested but `clang` (or `$CC`) is not runnable; or `scripts/build.sh` exited non-zero / could not be spawned | the per-platform install hint; or build.sh's stderr verbatim followed by `--link: <build.sh> failed (exit N); the IR is in ...` |
| 70 | internal compiler error: any other exception escaping `main` (`EX_SOFTWARE`) | `amritc <version>: internal compiler error while compiling <inputs>`, the exception, a request to report it at the issue tracker; the stack trace only with `AMRITC_DEBUG=1` |

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

## Not in this work package

- Windows native support (`build.sh` is bash; WSL is documented instead).
- Prebuilt binaries of the compiler itself: it is a Node program, and the
  tarball is the release artefact.

Multi-error reporting and `--json` diagnostics were listed here as a WP10
follow-up and have since landed in WP10 itself: every phase that can recover
hands its errors to one `DiagnosticSink` and the driver prints the first 20 in
source order, and `--json` writes one object per error on stdout
(`docs/wp10-ci.md`, "Multi-error reporting" and "`--json`"). stage1 answers
`--json` too (`self/compile.ts`), so the wrapper passes it straight through.
