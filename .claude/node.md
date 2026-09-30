# Node

This repo's tooling runs on **Node.js 22.18+ and npm**, not Bun. The sibling
repos (`mjst`, `mini`, `agent-ummo`) carry a `bun.md` that says "default to
Bun"; that rule is deliberately not carried here. The compiler itself is not a
Node program — it is `src/`, a native binary built by the last release — but
`nish` is published to npm as a tool a user installs with `npm install -g` on a
machine that has Node and clang and nothing else, the test harness and the
scripts are JavaScript, and CI (`.github/workflows/ci.yml`) runs the same
commands a user would.

- Use `node <file>` to run scripts, `npm install` / `npm ci` to install, and
  `npm run <script>` to run scripts. Do not introduce `bun`, `bunx`, `pnpm` or
  `yarn` anywhere, including in docs and CI.
- The published package has **no runtime dependency**. `bin/nish` hands over to
  the native compiler npm installed from the matching `@amritk/nish-<asset>`
  optional dependency, and an unsupported platform is an error rather than a
  fallback. `typescript` and `@biomejs/biome` are development dependencies:
  `npm run check`, the lexer and parser oracles and a few packaging checks use
  the first. Adding a runtime dependency is a design decision to raise in the
  PR, not a convenience.
- `tests/run.js` spawns the compiler the way a user's shell would —
  `build/nish-test`, which it builds from the seed at the start of the run — so
  a change to the CLI surface is tested end to end.
- Node built-ins are imported as `node:fs`, `node:path`, `node:child_process`.
  There is no `.env` loading. The compiler reads `PATH` (to find the tools
  `--link` runs) and `NISH_SIMULATE_ICE` (the test hook for the exit-70 path,
  in `src/ice.ts`); `scripts/build.sh` reads `CC`, the C compiler a link
  invokes; the harness reads `UPDATE_GOLDENS` and `NISH_BOOTSTRAP` (the seed).
  Without `NISH_BOOTSTRAP`, `npm test` skips nish-cmp and the stage1 fuzz, a
  third skip beside the two wasi ones. A cloud session's start hook exports it
  as `build/seed/bin/nish`; elsewhere, set it to run an undegraded suite.
  A new one is a CLI design decision, not a shortcut.
- Bun-specific APIs (`Bun.file`, `Bun.$`, `bun:sqlite`, HTML imports) do not
  exist here; use `node:fs` and `spawnSync` / `execFileSync`, as
  `tests/run.js` and `bench/run.mjs` do.

## Commands

```bash
npm install              # install (npm ci in CI)
bash scripts/fetch-seed.sh   # the last release into build/seed/ (NISH_BOOTSTRAP names another)
npm run build            # build/nish to keep (scripts/bootstrap.sh); npm test builds its own
npm run check            # ambient tsc --noEmit over src/, std/, tests/nish against runtime/nish.d.ts
npm test                 # tests/run.js: goldens, llvm-as, native round trips, runtime,
                         # layout, memory, interop, exit codes, packaging, bench checksums, differential
node tests/run.js <sub>  # only cases whose name contains <sub>
npm run test:update      # write missing .ll goldens
npm run test:diff        # the full differential set, against the frozen rewrites under Node
npm run lint             # file names + biome check, formatter disabled (.claude/linting.md)
npm run format           # biome format --write
npm run smoke            # build and run every example with a main
npm run size-report      # binary size table for examples/add.ts
node bench/run.mjs       # rewrite docs/BENCHMARKS.md (about 3 minutes)
docs/cookbook/regen.sh   # refresh docs/IR_COOKBOOK.md; node docs/check-links.mjs checks links
node scripts/arrowify.mjs --check <file.ts>   # WP22: what is still spelled `function`, and why
node scripts/arrow-verify.mjs [--debug]       # rewrite the corpus and diff every .ll byte for byte
node scripts/arrow-verify.mjs --applied src/  # the same, for a rewrite the tree already carries
node scripts/gen-diagnostic-codes.mjs --check  # src/codes.ts well formed, every code unique (CI + npm test)
node scripts/ci-profile.mjs                  # which check a CI job's wall clock went to
node scripts/ci-profile.mjs -- npm run test:nish   # ...for any suite command
```

**Profile the unfiltered run.** `node tests/run.js <substring>` is for finding a
failure, not for measuring one: a filtered count means nothing until
`rm -rf build/test`, and fifteen `fs.existsSync` guards drop checks with no
`SKIP` line to say so (see `.claude/testing.md`). `scripts/ci-profile.mjs`
measures from outside the process instead, so neither trap applies, and
`docs/wp10-ci.md` has the table it produced for `npm test` plus the job
durations it explains.

**`NODE_COMPILE_CACHE` is set for every CI job**, and is worth exporting
locally too. It is Node's own on-disk cache of V8's module compilation, not a
variable this repository reads, so it cannot reach the compiler's behaviour — the
compiler is not a Node program — and only saves the harness and the scripts
their start-up: a missing or stale key costs time and never changes an answer.

Two artefacts have a `--check` mode and both are gates: `docs/IR_COOKBOOK.md`,
and the diagnostic-code registry.

**The registry, `src/codes.ts`, is kept by hand.** Until WP19 R6
`scripts/gen-diagnostic-codes.mjs` wrote it — and a copy in stage0's `src/` — from a scan
of the TypeScript compiler's sources; that scan had nothing left to read once
stage0's `src/` was deleted, so the generator is frozen and only checks. Adding a
diagnostic means adding its fragment to `src/codes.ts` with the next free
number in its band. **A number is never moved, reused or handed out twice**: a
retired message keeps its entry, and `--check` fails on a duplicate code or an
entry that does not have the table's shape. It does not know whether a code is
*reached* — `tests/diagnostic-coverage.js` asks that, one `tests/wordings/`
program per code, and fails a code no program provokes and no line of
`tests/wordings/unreachable.txt` explains. In a merge conflict in
`src/codes.ts`, keep both sides' entries and renumber only the ones this branch
added, past `main`'s highest in the band.

## The toolchain that is not npm

Most of the suite needs **LLVM 18**: `clang`, `llc`, `llvm-as`, `opt`,
`ld.lld`, `wasm-ld`. `tests/run.js` skips the toolchain-dependent checks when
they are absent, so a green run without LLVM proves less than it looks. Install
per OS as in `docs/INSTALL.md` / `docs/wp10-ci.md`:

```bash
# Ubuntu / Debian
sudo apt-get install -y clang-18 lld-18 llvm-18
mkdir -p ~/.local/llvm-bin
for t in clang clang++ llc llvm-as opt ld.lld wasm-ld; do ln -sf /usr/bin/$t-18 ~/.local/llvm-bin/$t; done
export PATH=~/.local/llvm-bin:$PATH

# macOS
brew install llvm@18
export PATH="$(brew --prefix llvm@18)/bin:$PATH"
```

`scripts/build.sh`, `size-report.sh` and `smoke.sh` branch on `uname` for the
macOS linker flags; test a script change on both when you can, because CI
runs both.

## Biome

`biome.json` is the formatter and style linter for `src/`, `std/`, `bin/`,
`tests/**/*.js`, `examples/**`, `scripts/` and the rest of the JavaScript
tooling. It never influences compilation. **[`linting.md`](./linting.md) is the
authority on the rule set**: what each rule is for, and the ones measured and
left off. `npm run lint` runs `scripts/check-filenames.mjs`, which checks that
every tracked path is kebab-case, and then `biome check .` with the formatter
on, so an unformatted file fails CI the way a lint error does. So:

- Run `npm run format` (or `npm run lint:fix`, which also applies the safe lint
  fixes) before you commit. An agent does not need to: the `PostToolUse` hook
  in `.claude/settings.json` formats each file as it is edited.
- The rule set is the recommended preset, plus the rules that mirror what the
  validator refuses (`noVar`, `noExplicitAny`, `noEnum`, `noNamespace`,
  `noVoid`, `noParameterAssign`, `useExplicitLengthCheck`,
  `useConsistentArrayType`), plus the house style in `linting.md`: kebab-case
  file names, `useNamingConvention`, braces on every block, `noShadow`, an
  arrow bound to a `const` rather than a `function` declaration (the
  `biome-plugins/no-function-declaration.grit` plugin, because Biome ships no
  built-in rule for it) and the rest. `useOptionalChain` and
  `useExponentiationOperator` are turned *off* because they push code towards
  `?.` and `**`, which Nish rejects. `useImportType`, `useTemplate` and
  `noNonNullAssertion` are off as house style. The language-mirroring half is
  explained in `docs/wp0-validator.md` ("Biome").
- Every rule is an `error`, so `npm run lint` is either clean or red.
- The Nish programs a reader learns from (`examples/`, `docs/cookbook/`,
  `bench/*.ts`) are linted like the compiler, with the unused-variable and
  numeric-literal rules off. The test fixtures (`tests/cases`, `tests/link`,
  `tests/differential/corpus`) are not linted at all, because a `reject_*` case
  exists to contain what the rules forbid.
- `npm run lint:dead` runs knip (`knip.json`): no unused file, dependency or
  export. CI runs it, and shellcheck over the shell scripts, in the `lint` job.
- The sibling repos' Biome configs use single quotes, no semicolons and
  `trailingCommas: all`; this one agrees on the semicolons and not on the rest:
  - **No semicolons**, except where JavaScript's insertion rule needs one
    (`semicolons: "asNeeded"`). Nish accepts code without them by that same
    rule (`docs/LANGUAGE.md`, "Lexical rules"), and 0.12.0 is the first
    release that does, so the seed builds `src/` written that way. The test
    fixtures keep theirs, because the formatter does not read them.
  - **Quotes are only taste.** Nish accepts `'...'`. Double quotes are kept
    because every snippet in `docs/LANGUAGE.md`, `docs/AI.md` and the
    cookbook uses them, and so does the text a user copies out of those
    documents. Switching would be one more rewrite of every file, and there
    is nothing to gain from it.
  - **`trailingCommas`** stays `es5`, to match the rest of the tree.
