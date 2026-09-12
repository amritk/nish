# AGENTS.md

Guidance for AI coding agents (Cursor, Copilot, Claude Code, …) working **on
this compiler**. If you are instead **writing a program in the language**, this
is the wrong file: read [`docs/AI.md`](./docs/AI.md), which is the whole
language stated as rules in one pass, with the TypeScript reflexes Nish rejects
listed first. [`llms.txt`](./llms.txt) indexes both.

For Claude Code the same rules live in
[`CLAUDE.md`](./CLAUDE.md); the detailed developer guidelines are in
[`.claude/`](./.claude/) — read the one that matches your task:

- [`.claude/orientation.md`](./.claude/orientation.md) — **start here**: the two compilers, the code map, the commands, what is always true
- [`.claude/selfhost.md`](./.claude/selfhost.md) — working in `self/`: Nish-0, the module map, the oracles, the milestones
- [`.claude/architecture.md`](./.claude/architecture.md) — the pipeline, the rules that shape every change, where to read next
- [`.claude/typescript.md`](./.claude/typescript.md) — TypeScript style: the Nish rules for every program in the repo, and the static-friendly rules for the compiler source
- [`.claude/node.md`](./.claude/node.md) — Node runtime, npm scripts, the LLVM toolchain, Biome
- [`.claude/testing.md`](./.claude/testing.md) — the golden-test harness, what every construct ships with
- [`.claude/comments.md`](./.claude/comments.md) — comment and JSDoc guidelines

## What this is

`nish` (**Nish**) is an ahead-of-time compiler from a strictly static
subset of TypeScript to LLVM IR, published to npm as a single package. It is a
**Node.js + npm** project with one runtime dependency (`typescript`); the
sibling repos' Bun rules do not apply here. The reference documents are
[`docs/LANGUAGE.md`](./docs/LANGUAGE.md) (what the language is) and
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) (how the compiler is put
together); [`docs/MASTER_PLAN.md`](./docs/MASTER_PLAN.md) is the work-package
plan, with the conventions every agent follows in §7 and a brief template in §8.

## Workflow

```bash
npm install                 # install (npm ci in CI)
npm run check               # tsc --noEmit
npm test                    # build + the full suite (goldens, llvm-as, native, runtime, differential)
node tests/run.js <sub>     # only cases whose name contains <sub>
npm run test:update         # write missing .ll goldens for new cases
npm run lint                # biome, advisory
npm run smoke               # build and run every example with a main
```

Most of `npm test` needs LLVM 18 on `PATH` (`clang`, `llc`, `llvm-as`, `opt`,
`ld.lld`, `wasm-ld`); without it the toolchain-dependent checks are skipped,
not failed, so a green run without LLVM proves less than it looks. Install
steps per OS are in [`docs/INSTALL.md`](./docs/INSTALL.md).

## Machine-readable surfaces

Read these rather than scraping prose; they are contracts with tests behind
them. [`docs/AI.md`](./docs/AI.md) documents the same surfaces for an agent
*using* the compiler, and ships in the npm tarball so an install describes
itself.

| Ask | Command | Answer |
| --- | --- | --- |
| what the CLI accepts | `nish --help` | usage text on **stdout**, exit **0**. A usage *error* prints the same text on stderr with exit 2, so the stream and the code tell a request apart from a refusal |
| what is wrong with a program | `nish --json <files>` | one JSON object per line on stdout, nothing on stderr, exit unchanged |
| the version | `nish --version` | `nish <semver>` on stdout, exit 0 |
| what the compiler parsed | `nish --emit-ast <file>` | the syntax tree, one node per line |
| what the checker recorded | `nish --emit-checked <file>` | the side tables the emitter reads |

Every `--json` object is flat:
`{"file","line","column","endLine","endColumn","severity","code","message"}`,
1-based, `endLine`/`endColumn` exclusive.

- **`severity`** is `"error"` or `"performance"`. A performance warning never
  changes the exit code.
- **`code`** is the stable rule identifier — `NL1013`, `NL2231` — and is the
  field to key on. The prose in `message` may improve between releases; the
  code may not. `NL0000` means the message has no rule yet. The bands
  (`NL1xxx` Phase 0, `NL2xxx` checker, `NL3xxx` driver, `NL4xxx` interop,
  `NL9xxx` performance, `NL0001`–`NL0003` syntax / toolchain / internal) and
  the registry are documented in
  [`docs/wp10-ci.md`](./docs/wp10-ci.md#code). The registry lives in
  `src/codes.ts` and `self/codes.ts` and is **generated** by
  `scripts/gen-diagnostic-codes.mjs`; run it after adding a diagnostic, or
  `npm test` fails while it is stale.
- A failure with no source position — an unusable C toolchain, an internal
  compiler error, a bad `-o` layout — is still one JSON line,
  `{"severity","code","message"}`. Under `--json` you never have to read stderr
  to find out why a run failed.

Exit codes (`docs/wp12-release.md`): **0** ok, **1** the program was rejected,
**2** usage, **3** toolchain (clang or `scripts/build.sh`), **70** internal
compiler error — a bug in `nish`, not in the input.

## Trusting a test run

`npm test` ends with `N passed, M failed, K skipped`. **The skip count is the
number that decides what a green run is worth**: without LLVM 18 the
toolchain-dependent checks — assembly, native round trips, linking, the interop
addons, the self-hosting oracles, the differential suite — skip rather than
fail, and the run prints a `DEGRADED:` banner naming the tools it could not
find. A run that skipped anything has not proved what it looks like it proved.
`.claude/hooks/session-start.sh` installs the toolchain in a fresh container so
this does not happen silently.

## House rules

- **`npm test` must be green**, and every new construct ships with a golden
  `.ll`, an `llvm-as` pass, a native round trip with expected stdout, at least
  one negative test, its `docs/LANGUAGE.md` rule and cookbook entry, and a
  `CHANGELOG.md` line. There is no changesets flow here; the changelog is the
  record.
- **Never emit an LLVM attribute you cannot cite a checker proof for.** Write
  the reason in `src/codegen/attributes.ts` beside the code.
- **A struct layout change touches `runtime.ts` and `runtime.c` in the same
  commit** and extends a layout test. Keep `runtime.c` within its budget and
  report its size in the PR.
- **Do not widen scope into another work package's files**; leave a
  `TODO(WP<n>)` instead.
- **Never** put Claude/session links, tracking IDs, model names or platform
  attributions in commits, code, or PR text. Commit messages: imperative
  subject, body explaining the lowering.
- **In the compiler's own source, declare types with `type` and functions as
  arrows bound to a `const`.** Both are linted at `warn` while the existing
  code is migrated, so the warning count is the backlog rather than a failure.
  Class methods stay methods. An Nish program is exempt and must use
  `function` and `interface`, because the language has neither arrow functions
  nor `type` aliases.
- Match the surrounding code's style, comment density, and naming. Biome
  (`biome.json`) is the formatter and linter, run with the formatter disabled
  in `npm run lint`; keep new files formatted and do not reformat files you did
  not otherwise change.
- Show the exact LLVM IR for every TypeScript snippet a PR adds to the tests.
