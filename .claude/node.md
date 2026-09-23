# Node

This repo's tooling runs on **Node.js 22.18+ and npm**, not Bun. The sibling
repos (`mjst`, `mini`, `agent-ummo`) carry a `bun.md` that says "default to
Bun"; that rule is deliberately not carried here. The compiler itself is not a
Node program — it is `self/`, a native binary built by the last release — but
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
  in `self/ice.ts`); `scripts/build.sh` reads `CC`, the C compiler a link
  invokes; the harness reads `UPDATE_GOLDENS` and `NISH_BOOTSTRAP` (the seed).
  A new one is a CLI design decision, not a shortcut.
- Bun-specific APIs (`Bun.file`, `Bun.$`, `bun:sqlite`, HTML imports) do not
  exist here; use `node:fs` and `spawnSync` / `execFileSync`, as
  `tests/run.js` and `bench/run.mjs` do.

## Commands

```bash
npm install              # install (npm ci in CI)
bash scripts/fetch-seed.sh   # the last release into build/seed/ (NISH_BOOTSTRAP names another)
npm run build            # build/nish to keep (scripts/bootstrap.sh); npm test builds its own
npm run check            # ambient tsc --noEmit over self/, std/, tests/nish against runtime/nish.d.ts
npm test                 # tests/run.js: goldens, llvm-as, native round trips, runtime,
                         # layout, memory, interop, exit codes, packaging, bench checksums, differential
node tests/run.js <sub>  # only cases whose name contains <sub>
npm run test:update      # write missing .ll goldens
npm run test:diff        # the full differential set, against the frozen rewrites under Node
npm run lint             # biome check, formatter disabled (advisory, never a compile gate)
npm run format           # biome format --write
npm run smoke            # build and run every example with a main
npm run size-report      # binary size table for examples/add.ts
node bench/run.mjs       # rewrite docs/BENCHMARKS.md (about 3 minutes)
docs/cookbook/regen.sh   # refresh docs/IR_COOKBOOK.md; node docs/check-links.mjs checks links
node scripts/arrowify.mjs --check <file.ts>   # WP22: what is still spelled `function`, and why
node scripts/arrow-verify.mjs [--debug]       # rewrite the corpus and diff every .ll byte for byte
node scripts/arrow-verify.mjs --applied self  # the same, for a rewrite the tree already carries
node scripts/gen-diagnostic-codes.mjs --check  # self/codes.ts well formed, every code unique (CI + npm test)
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

**The registry, `self/codes.ts`, is kept by hand.** Until WP19 R6
`scripts/gen-diagnostic-codes.mjs` wrote it — and a copy in `src/` — from a scan
of the TypeScript compiler's sources; that scan had nothing left to read once
`src/` was deleted, so the generator is frozen and only checks. Adding a
diagnostic means adding its fragment to `self/codes.ts` with the next free
number in its band. **A number is never moved, reused or handed out twice**: a
retired message keeps its entry, and `--check` fails on a duplicate code or an
entry that does not have the table's shape. It does not know whether a code is
*reached* — `tests/diagnostic_coverage.js` asks that, one `tests/wordings/`
program per code, and fails a code no program provokes and no line of
`tests/wordings/unreachable.txt` explains. In a merge conflict in
`self/codes.ts`, keep both sides' entries and renumber only the ones this branch
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

`biome.json` is the formatter and style linter for `self/`, `std/`, `bin/`,
`tests/**/*.js`, `examples/**` and the rest of the JavaScript tooling. It never influences compilation. `npm run lint` runs the checks
with the formatter **disabled**, because not every file has been formatted to
the shared style yet, and reformatting a file in a PR that is about something
else is noise in the diff. So:

- Keep new code in Biome's style (double quotes, semicolons, 110 columns,
  two-space indent) and run `npm run format` on the files you created.
- Do not reformat a file you did not otherwise change.
- The rule set is the recommended preset plus the rules that mirror what the
  validator refuses (`noVar`, `noExplicitAny`, `noEnum`, `noNamespace`,
  `noVoid`, `noParameterAssign`, `useExplicitLengthCheck`,
  `useConsistentArrayType`, `useFilenamingConvention`), with `useOptionalChain`
  and `useExponentiationOperator` turned *off* because they push code towards
  `?.` and `**`, which Nish rejects. `useImportType`, `useTemplate` and
  `noNonNullAssertion` are off as house style. The full reasoning is in
  `docs/wp0-validator.md` ("Biome").
- Two house-style rules are `warn` rather than `error` because the source
  predates them: `useConsistentTypeDefinitions` (`type`, never `interface`)
  and the `biome-plugins/no-function-declaration.grit` plugin (an arrow bound
  to a `const`, never a `function` declaration). Biome ships no built-in rule
  for the second, which is why it is a GritQL plugin. Warnings do not fail
  `biome check`, so `npm run lint` stays green and the count is the migration
  backlog; `npm run lint -- --diagnostic-level=error` hides it while you look
  for real errors.
- The Nish programs a reader learns from (`examples/`, `docs/cookbook/`,
  `bench/*.ts`) are linted too, with the unused-variable and numeric-literal
  rules off, and with both house-style rules off as well. **The reason for the
  second half has changed and the setting has not yet.** It used to be that the
  language had neither arrow functions nor `type` aliases, so `function` and
  `interface` were the only spellings available there; it has both now
  (`docs/wp22-arrow-functions.md`), and what the exemption buys today is only
  that the 22 `function` declarations still in `bench/` do not shout until
  their file is opened. New code in them is an arrow like everywhere else, and
  the exemption comes off surface by surface as stage C migrates each one;
  `self/` is under the plugin already. The test fixtures (`tests/cases`,
  `tests/link`, `tests/differential/corpus`) are not linted at all, because a `reject_*` case
  exists to contain what the rules forbid.
- The sibling repos' Biome configs use single quotes, no semicolons and
  `trailingCommas: all`; those formatter settings are not carried over.
  Flipping them would rewrite every file in `self/`, and the formatter is not a
  gate here anyway.
