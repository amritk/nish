# Node

This repo runs on **Node.js 18+ and npm**, not Bun. The sibling repos (`mjst`,
`mini`, `agent-ummo`) carry a `bun.md` that says "default to Bun"; that rule is
deliberately not carried here. `amritc` is published to npm as a tool a
user installs with `npm install -g` on a machine that has Node and clang and
nothing else, and CI (`.github/workflows/ci.yml`) runs the same commands a user
would.

- Use `node <file>` to run scripts, `npm install` / `npm ci` to install, and
  `npm run <script>` to run scripts. Do not introduce `bun`, `bunx`, `pnpm` or
  `yarn` anywhere, including in docs and CI.
- `dist/` is what `tsc` wrote (`npm run build`), **ES modules**, no bundler. The
  CLI entry is `dist/index.js`; `tests/run.js` spawns it the way a user's shell
  would, so a change to the CLI surface is tested end to end.
- The only runtime dependency is `typescript`. Adding a second one is a
  design decision to raise in the PR, not a convenience.
- Node built-ins are imported as `node:fs`, `node:path`, `node:child_process`.
  There is no `.env` loading. The only environment variables read are `CC`
  (the C compiler `--link` invokes), `AMRITC_DEBUG` (full stack on an
  internal error) and `AMRITC_SIMULATE_ICE` (test hook) in `src/index.ts`,
  plus `UPDATE_GOLDENS` in the test runner. A new one is a CLI design decision,
  not a shortcut.
- Bun-specific APIs (`Bun.file`, `Bun.$`, `bun:sqlite`, HTML imports) do not
  exist here; use `node:fs` and `spawnSync` / `execFileSync`, as
  `tests/run.js` and `bench/run.mjs` do.

## Commands

```bash
npm install              # install (npm ci in CI)
npm run build            # rm -rf dist && tsc
npm run check            # tsc --noEmit
npm test                 # build + tests/run.js: goldens, llvm-as, native round trips, runtime,
                         # layout, memory, interop, exit codes, packaging, bench checksums, differential
node tests/run.js <sub>  # only cases whose name contains <sub>
npm run test:update      # write missing .ll goldens
npm run test:diff        # the full differential set against Node
npm run lint             # biome check, formatter disabled (advisory, never a compile gate)
npm run format           # biome format --write
npm run smoke            # build and run every example with a main
npm run size-report      # binary size table for examples/add.ts
node bench/run.mjs       # rewrite docs/BENCHMARKS.md (about 3 minutes)
docs/cookbook/regen.sh   # refresh docs/IR_COOKBOOK.md; node docs/check-links.mjs checks links
node scripts/gen-diagnostic-codes.mjs        # rewrite src/codes.ts + self/codes.ts
node scripts/gen-diagnostic-codes.mjs --check  # fail if either is stale (CI + npm test)
```

Three generated artefacts have a `--check` mode and all three are gates:
`docs/IR_COOKBOOK.md`, and the two halves of the diagnostic-code registry.
Adding a diagnostic means running the code generator; it appends a number and
never moves one that already exists.

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

`biome.json` is the formatter and style linter for `src/`, `tests/**/*.js` and
`examples/**`. It never influences compilation. `npm run lint` runs the checks
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
  `?.` and `**`, which AmritScript rejects. `useImportType`, `useTemplate` and
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
- The AmritScript programs a reader learns from (`examples/`, `docs/cookbook/`,
  `bench/*.ts`) are linted too, with the unused-variable and numeric-literal
  rules off, and with both house-style rules off as well: the language has no
  arrow functions and no `type` aliases, so `function` and `interface` are the
  only spellings available there; the test fixtures (`tests/cases`, `tests/link`,
  `tests/differential/corpus`) are not, because a `reject_*` case exists to
  contain what the rules forbid.
- The sibling repos' Biome configs use single quotes, no semicolons and
  `trailingCommas: all`; those formatter settings are not carried over.
  Flipping them would rewrite every file in `src/`, and the formatter is not a
  gate here anyway.
