# Make the no-panic check strict by default, with `--allow-panics` to relax it

## Goal

Today `--deny-panics` (or a `"nish": { "noPanic": [...] }` list in the root
`package.json`) is opt-in: without it, an unproven index, overflow, divide,
`panic()` and so on compile to a runtime check that exits 1. Flip the default:
**every module of the root package is in the no-panic scope unless the build
passes `--allow-panics`.** That flag is the only way to relax the check. There
is no manifest switch for it, and `"noPanic": []` gets no new meaning. Then
update the examples so they compile under the new default.

This is a breaking change for every existing Nish project (`feat(cli)!`). The
project stays on 0.x, so this moves the minor version. Never propose 1.0.0 or
add `Release-As:`.

Read `CLAUDE.md`, `.claude/orientation.md`, `.claude/selfhost.md`,
`.claude/testing.md`, `.claude/architecture.md` and `AGENTS.md` ("Shipping a
change") first. Their rules are authoritative.

## What is already known (measured in an earlier session, seed nish 0.42.0)

- **`--deny-panics` changes no byte of the IR** (`src/options.ts`, the
  `denyPanics` doc comment). It only decides whether the build happens, so
  flipping it costs no runtime speed. It does turn on panic-site recording for
  every build (`Options.recordsPanics()` in `src/options.ts`, read in
  `src/attributes.ts` and `src/compilation.ts`). Measure the compile-time cost
  of always recording on a large program (the compiler's own `src/compile.ts`)
  and report it in the PR as a `Measured:` trailer, with its noise band.
- **What the scope refuses** is every panic site but `oom` and `unchecked`:
  `index`, `overflow` (every `+ - *` on `i32`/`i64` not proven to fit),
  `divide`, `slice`, `pop`, `range`, `array-length`, `panic`, `expect`,
  `io-exit` (`readFileSync`...), `region`, the `ffi-*` kinds, and `call` (a
  call into anything that may panic, the standard library included). See
  `docs/LANGUAGE.md` → "Panic sites" (about line 16028) and `src/panics.ts`.
- **Examples:** of the programs under `examples/` that build today, these were
  refused under `--deny-panics`: `add.ts`, `argv.ts`, `arrays.ts`, `math.ts`,
  `sets.ts`, `wordcount.ts`. `examples/add.ts` is the one-liner
  `export const add = (a: number, b: number): number => a + b`, refused for
  `overflow`. Re-survey every example (`examples/*.ts`, `examples/*/main.ts`
  and the directories with their own build: `api-cli`, `game-starter`,
  `http-app`, `relay`, `wasm-arena`, `multi`, `break-web`) with the flags
  each one is really built with (`tests/run.js` lines ~6427-6460 hold
  per-example number modes, and some examples carry a `// smoke:` line).
- **A real downstream project:** `amritk/vector` (77k lines of Nish) builds
  cleanly today and gets **2,459 errors on 2,065 lines in 92 files** under
  `--deny-panics`: 853 `overflow`, 840 `index`, 678 `call` (460 of them reach
  sites inside `std/`: 268 in `std/collections.ts`, 130 in `std/text.ts`, and
  `std/array.ts`, `std/json.ts`, `std/regex.ts`, `std/sort.ts`), 88 others.
  **`new Map()`, `Map.set`, `Set.add`, `trim`, `split` and JSON reads cannot
  be called from a strict module today**, because the panic sites are in
  `std/`. A user cannot fix that in their own code. Examples that use them
  (`sets.ts`, `wordcount.ts`) can only pass strict after `std/` is fixed. This
  PR does not fix `std/` (see "Out of scope").
- **Known prover gaps** (checked against the seed): a guard or a length that
  is a named constant (`const N: i32 = 8`) or a converted literal
  (`toU64(0)`) is not read as its value, though the literal is
  (`b !== 0 ? a % b : a` proves, `b !== toU64(0) ? ...` does not). The range
  of `x & mask` and of `charCodeAt` is not known, and a down-counting loop
  (`while (end > 0 ...) end -= 1`) loses `end <= length`. Vector's
  `span === toU64(0) ? draw : ... % span` is refused for the first reason.
  Do not fix them here; they are a separate PR.
- **The seed** (`build/seed/bin/nish`, 0.42.0) exits 2 on `--allow-panics`
  (`compile: unknown flag`), which was checked. Until the release after this
  change becomes the seed, nothing may pass the flag to it.

## Design (decided; implement this, don't reopen it)

The scope is computed in `Compilation.readNoPanic` (`src/compilation.ts`,
about line 1660). New rule:

1. **Default:** every module of the root package (`unit.packageName ===
   ROOT_PACKAGE`) is in scope. Dependencies and `std/` are not in scope, but a
   call from a scoped module into one that may panic is still a `call` site,
   as today.
2. **`--allow-panics`** drops the default. The scope is then exactly what it
   is today without a flag: the modules the root package's `"nish".noPanic`
   lists, or nothing. So a package's committed list still holds under the flag:
   `--allow-panics` relaxes the rest of the package, never a listed module.
3. **`"nish".noPanic` keeps its meaning and its syntax.** It adds the listed
   modules to the scope. Under the default it changes nothing, since every
   module is already in scope. NL3031 (an entry naming no module) stays. Don't
   give `"noPanic": []` or any other manifest value the power to relax the
   default.
4. **`--deny-panics`** stays and puts every root-package module in scope (as
   today), so it is the default spelled out. Keep it working for scripts
   and tests that pass it.
5. **The name `--allow-panics` is provisional** and will be renamed in a later
   PR. Spell it in one constant in `src/compile.ts` (or `src/options.ts`) and
   have the help row, the diagnostic wording and the test helpers read it from
   there or from one place each, so the rename is a small diff.
6. Both flags on one command line: the last one wins. If the CLI has an
   established convention for opposing flags, follow that instead and say so.
7. `--emit-ast` stops before the check. `src/compile.ts` (about line 1422)
   refuses `--deny-panics` with `--emit-ast`: keep refusing the explicit flag,
   and skip the default check silently.
8. Decide and document what `nish run`, `--emit-ts`, `--compat` and every
   other path that checks a program does under the new default. Strict
   everywhere is the default answer. A path that has to differ needs a reason
   written in the code.

Every diagnostic the scope raises (NL2457, NL2458 and any sibling; find them in
`src/codes.ts` and `src/panics.ts`) says how to relax it. Today the wording
says "a module in the no-panic scope (`--deny-panics` or `noPanic`)". Change it
to name the default and the way out, for example "a module of this package is
held to no panic by default; `--allow-panics` relaxes the modules `noPanic`
does not list". A module that is in scope because `noPanic` lists it must say
so instead, because `--allow-panics` doesn't relax it.
A changed message must be grepped across the whole repo and every pinned copy
regenerated from the compiler's output: `tests/wordings/*.err`,
`tests/link/*/expected.err`, `expected.json`, `docs/reference/diagnostics/`.

## The repository itself must keep building

The compiler, its tests and its scripts are full of code that can panic on
purpose. They must keep compiling under the new default without any change to
what they test.

The only way to relax the check is the flag, so every place that builds a
program which is not meant to be panic-free passes `--allow-panics`. The
seed doesn't know the flag, so it must never be passed to the seed.

- **One rule decides who gets the flag:** pass `--allow-panics` to a compiler
  only if that compiler accepts it. Answer the question once per compiler
  binary, by probing it (for example, its `--help` lists the flag), in one
  shared helper per language: a shell function for `scripts/*.sh` and one JS
  module that every test script imports. Don't hard-code "the seed never gets
  it". A `NISH_BOOTSTRAP` seed can be any release, and after the next release
  the seed accepts the flag. The probe makes the rule hold either way, and the
  helper can go once every supported seed accepts the flag. Write that in its
  comment.
- **The self-build.** `scripts/bootstrap.sh` builds stage1 with the seed
  (lax by default, no flag needed), then stage2 and stage3 with the new
  compiler, which is strict and would refuse `src/`: those stages get
  `--allow-panics`. Check every other script that compiles `src/` or `std/`
  (`scripts/ddc-chain.sh`, `scripts/fetch-seed.sh` users,
  `tests/self/goldens.js` with `--seed`, `npm run sync-main`, the release
  build, `.github/workflows/*` and the composite actions). Adding the flag
  must leave the stage2 = stage3 fixed point and every golden byte-identical,
  because a flag moves no IR. `bash scripts/bootstrap.sh --verify` proves it.
  The rolling freeze (CI's `bootstrap` job) must stay green: `src/` itself
  uses nothing new.
- **The test corpus.** `tests/run.js` spawns the compiler from hundreds of
  sites (`spawnSync(NISH, ...)`). Route them through the helper, which adds
  `--allow-panics` unless that call's own arguments decide the scope
  (`--deny-panics`, or a program whose test is about `noPanic`). Under the new
  rule a `noPanic` list holds under the flag, so the `noPanic` tests still
  test what they test. Do the same in every other test script that spawns the
  compiler: `tests/ffi-*.js`, `tests/differential/*`, `tests/self/*`,
  `tests/nish-cmp.js`, `tests/panics-oracle.js`, and any other caller you
  find. Also check whether a test asserts a compiler's exact argument list,
  as `tests/run.js` does around line 1457 (`const allowed = [...]`).
- **`tests/link/`** has about 155 packages with their own `package.json`.
  Find out how their runner builds them, and make sure the helper reaches it.
  The no-panic tests (`tests/link/no_panic_*`,
  `caps_policy_manifest_*no_panic*`, `deny_retention_dependency`) must still
  test what they test. Regenerate any `expected.caps.json` that moves.
- **`examples/` is built strict, without the flag.** Its tests (the examples
  section, the `examples/hello.ts` / `examples/multi/main.ts` builds in the
  self-hosted compiler section around line 9125, the performance ratchet
  around line 8207) call the compiler with no `--allow-panics`. An example
  that must opt out (below) passes it visibly, in the place it is built.
- `tests/host-import`, `bench/` and the docs snippets: same rule. Lax where
  the program isn't meant to be panic-free, strict where a user would copy it.

## Tests the change adds

- **Default strict:** a `tests/link` package with no `noPanic` key and no
  flag, refused with the new wording (`expected.err`). This is the negative
  for the changed default.
- **`--allow-panics`** on the same program builds.
- **A `noPanic` list under `--allow-panics`** still refuses the listed module
  and accepts the rest, with the wording for a listed module.
- **`"noPanic": []` under the default** is still refused: an empty list
  doesn't relax anything.
- **The helper's probe:** a compiler that doesn't list `--allow-panics` (the
  seed) is never passed it.
- **Both flags:** the last one wins, or whatever rule you chose.
- **`--emit-ast`** without a flag builds, and with `--deny-panics` is still
  refused.
- The existing `tests/cases/reject_deny_panics_*` and `deny_panics_*` keep
  passing unchanged.

Show the exact LLVM IR for every TypeScript snippet the PR adds to the tests
(CLAUDE.md). A flag only gates the build, so for a positive case that IR must
be byte-identical with and without the flag: assert that.

## The examples

For each refused example, fix it the way the guide should teach, never by
silencing the check:
- Prefer a guard the prover reads (`if (i < 0 || i >= xs.length) { ... }`, a
  loop bounded by `xs.length`), a type that states the intent (`u32` where
  wrapping is meant, `integer<Lo, Hi>` where a range is), or `Result` /
  `readFileSyncOrNull` / `orReturn` instead of `expect`, `panic` or
  `readFileSync`.
- Don't reach for `wrappingAdd` / `uncheckedGet` from `nish:unsafe`, or a guard
  that returns a made-up value such as `0`, just to quiet an error. A guard
  handles the bad case for real: report it, return an error, or skip it.
- An example that is only refused for a call into `std/` (expected:
  `sets.ts`, `wordcount.ts`) can't be fixed here. Have it opt out in a
  committed way the reader can see (a comment naming the reason and the
  follow-up, plus `--allow-panics` wherever it is built or run). List these in
  the PR body.
- `examples/add.ts`: decide whether an exported `a + b` on unbounded input
  should take a ranged type, return a `Result`, or be the documented opt-out.
  Pick what the guide can explain in one sentence.

Every example still has to run with the same stdout it had before. Its
`tests/run.js` checks prove that.

## Docs (CLAUDE.md: the user guide moves with the language)

- `docs/LANGUAGE.md` → "Panic sites": the scope rule above, normative.
- `docs/guide/using-nish/cli.md` (and any guide page that shows `--deny-panics`
  or a program the new default refuses): the default, `--allow-panics`, and
  what a `noPanic` list still does under it. Every guide snippet a user would copy must compile under the
  new default, or say why it opts out. Find out whether guide snippets are
  compiled by a test, and under which `package.json`.
- `src/cli-style.ts`: the `--help` row (`menu.row("--deny-panics", ...)`,
  about line 93) plus a row for `--allow-panics`. Add the agent's section:
  keep the default strict, fix refusals rather than relaxing, and don't
  silence a refusal with `nish:unsafe` or a fake guard.
- `docs/AI.md`: the same guidance for agents writing Nish.
- `docs/reference/` is generated: `node scripts/gen-reference.mjs`, then
  `--check`. `docs/reference/config/package-json.md` and
  `docs/reference/command-line.md` should come out of that.
- Grep the old answer ("opt-in", "`--deny-panics` or `noPanic`",
  "`--deny-panics` puts all of them in") across `docs/`, `.claude/`,
  `llms.txt`, `skills/`, `runtime/nish.d.ts` and source comments, and update
  every pointer (CLAUDE.md: moving where a fact lives).
- `examples/break-web/help.ts` mentions the flag: check it.
- `docs/site/break/` is built and committed by `examples/break-web/build.mjs`.
  Rebuild it if its help text changes.

## Commit and PR

Conventional subject, for example `feat(cli)!: hold the root package to no
panic by default; --allow-panics relaxes it`, with a `BREAKING CHANGE:` body
that a reader of the release notes can act on. It names the default, the way
to relax it (`--allow-panics`; a `noPanic` list still holds under it), and the
`std/` limitation (a strict module can't yet call `Map`, `Set`, `trim`,
`split` or JSON reads), with the vector figures as the scale of the break.
Trailers: `Measured:` (the compile-time cost of always recording),
`Refs: docs/LANGUAGE.md#panic-sites`, `Tests:`.

## Definition of done (CLAUDE.md)

Locally: `npm run check`, `npm run lint` (read the exit status, never a piped
tail), `node tests/run.js <filter>` for every section touched (the panic,
deny-panics, link, cli, examples and wordings sections at least),
`node tests/run.js wasi` (with `WASI_SYSROOT=/usr`; read its skip line),
`node tests/run.js performance`, the goldens (`node tests/self/goldens.js
--update`, then read the diff), `node scripts/gen-reference.mjs --check`, and
nish-cmp if any corpus program's IR moves (it shouldn't; a flag moves no IR).
`scripts/bootstrap.sh --verify` must still reach the fixed point. Then push,
open the PR, and let CI's nine `test` shards answer for the rest. Read each
shard's skip count.

## Out of scope (record each as a follow-up in the PR body)

1. Close the prover gaps above (named constants and converted literals,
   `&` masks, `charCodeAt`, down-counting loops). Most of std's sites behind
   vector's refusals are these.
2. Make what is left in `std/collections.ts` (`Map`, `Set`), `std/text.ts`
   (`trim`, `split`...), `std/json.ts`, `std/array.ts`, `std/regex.ts` and
   `std/sort.ts` panic-free or proven, so a strict module can use them. This
   is what makes the default usable for real projects. Mind CLAUDE.md's rule
   on `std/` line moves.
3. Report every `nish:unsafe` import a strict build relies on, so that
   `wrappingAdd` / `uncheckedGet` used to quiet the check is visible.
4. A migration note for downstream projects such as `amritk/vector`: add
   `--allow-panics` to the build script, then make modules strict one at a
   time by listing them in `noPanic`, which the flag doesn't relax. Once every
   module is listed, drop the flag.
