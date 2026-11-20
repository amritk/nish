---
name: Strict by default — the root package is held to no panic unless the build passes --allow-panics
overview: Flip the no-panic check from opt-in to the default for every module of the root package, with --allow-panics as the only way to relax it (a noPanic list still holds under it). Land it in three PRs — the flag and the build harness first (no behaviour change), the examples made panic-free in parallel, then the flip itself with its wording, tests and docs.
stages:
  - id: s1-flag-harness
    title: "feat(cli): add --allow-panics and pass it wherever the repository builds a program that may panic"
    goal: The compiler accepts --allow-panics (a no-op until the default flips — the scope is then the noPanic list), and every place the repository builds a program not meant to be panic-free passes it through one probing helper per language, so stage 3 can flip the default without touching the harness.
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js deny-panics && node tests/run.js no-panic && node tests/run.js link && node tests/run.js cli && node tests/run.js examples && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && bash scripts/bootstrap.sh --verify && node tests/self/goldens.js && node scripts/gen-reference.mjs --check, each tests/run.js summary read for a nonzero case count
    todos:
      - id: flag-constant
        content: Add --allow-panics to the CLI, spelled in one exported constant, with last-of-the-two-flags-wins against --deny-panics (or the CLI's existing convention for opposing flags) and a help row in src/cli-style.ts — see S1 — the flag
        status: pending
      - id: sh-helper
        content: Add one shell function that probes a compiler binary's --help for the flag and yields it only when listed, and route scripts/bootstrap.sh stage2 and stage3 and every other scripts/*.sh build of a non-example program through it — see S1 — the helpers
        status: pending
      - id: js-helper
        content: Add one JS module the test scripts import that probes once per compiler binary and adds the flag unless the call's own arguments decide the scope; route every spawnSync(NISH, ...) in tests/run.js and every other test script that spawns the compiler through it, leaving the examples builds strict — see S1 — the helpers
        status: pending
      - id: ci-and-actions
        content: Check .github/workflows and .github/actions, bench/ and tests/host-import for compiler calls on non-example programs and route them the same way — see S1 — the helpers
        status: pending
      - id: s1-tests
        content: Add the tests that hold before and after the flip — the probe never passes the flag to a compiler that does not list it, both-flags rule, --emit-ast with and without --deny-panics, a noPanic list under --allow-panics, IR byte-identical with and without the flag — see S1 — tests
        status: pending
      - id: s1-docs
        content: Document --allow-panics in docs/guide/using-nish/cli.md and the helper in .claude/testing.md, and regenerate docs/reference — see S1 — the flag
        status: pending
  - id: s2-examples
    title: "fix(examples): make the examples panic-free under --deny-panics"
    goal: Every example under examples/ builds under --deny-panics (which stage 3 makes the default) with its real build flags and the same stdout, except the ones refused only for a call into std/, which carry a visible opt-out comment.
    verification: bash scripts/fetch-seed.sh && bash scripts/bootstrap.sh && node tests/run.js examples && bash scripts/smoke.sh && node tests/self/goldens.js && npm run check && npm run lint, plus the stage's survey script rerun showing every non-opt-out example builds under --deny-panics
    todos:
      - id: survey
        content: Re-survey every example (examples/*.ts, examples/*/main.ts and the directories with their own build) under --deny-panics with the flags each is really built with, and record which are refused and for what — see S2 — survey
        status: pending
      - id: fix-examples
        content: Fix each refused example the way the guide should teach (a guard the prover reads, a type that states the intent, Result or readFileSyncOrNull instead of expect, panic or readFileSync), never with nish:unsafe or a made-up return value — see S2 — fixing an example
        status: pending
      - id: add-ts
        content: Decide what examples/add.ts becomes (ranged type, Result, or the documented opt-out), in a form the guide can explain in one sentence, and move every quote of it — see S2 — examples/add.ts
        status: pending
      - id: opt-outs
        content: Give each example refused only for a call into std/ (expected sets.ts and wordcount.ts) a comment naming the reason and the follow-up, and list them in the PR body — see S2 — opt-outs
        status: pending
  - id: s3-flip
    title: "feat(cli)!: hold the root package to no panic by default; --allow-panics relaxes it"
    goal: Without --allow-panics every module of the root package is in the no-panic scope; under it the scope is exactly the noPanic list. Diagnostics name the default and the way out, the opt-out examples pass the flag where they are built, and the language spec, guide, help and agent docs teach the new default.
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js panic && node tests/run.js no-panic && node tests/run.js deny-panics && node tests/run.js link && node tests/run.js cli && node tests/run.js examples && node tests/run.js wordings && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && bash scripts/bootstrap.sh --verify && node tests/self/goldens.js && node scripts/gen-reference.mjs --check && node docs/check-links.mjs && bash scripts/smoke.sh
    todos:
      - id: scope-rule
        content: Change Compilation.readNoPanic in src/compilation.ts so the default scope is every root-package module and --allow-panics leaves exactly the noPanic list; --emit-ast skips the default check silently and still refuses an explicit --deny-panics — see S3 — the scope rule
        status: pending
      - id: other-paths
        content: Decide and document in the code what nish run, --emit-ts, --compat and every other path that checks a program does under the new default (strict unless a written reason) — see S3 — the scope rule
        status: pending
      - id: wording
        content: Reword NL2457, NL2458 and every sibling scope diagnostic to name the default and --allow-panics, with a distinct wording for a module in scope because noPanic lists it; regenerate every pinned copy from the compiler — see S3 — wording
        status: pending
      - id: s3-tests
        content: Add tests/link negatives — default strict with no noPanic key and no flag, an empty noPanic list under the default — and the positive of the same program under --allow-panics with its IR shown — see S3 — tests
        status: pending
      - id: example-opt-outs
        content: Pass --allow-panics visibly wherever each stage-2 opt-out example is built or run (tests/run.js, scripts/smoke.sh, CI), and nowhere else under examples — see S3 — examples
        status: pending
      - id: s3-docs
        content: Update docs/LANGUAGE.md Panic sites (normative rule), docs/guide (cli page and every page showing --deny-panics or a now-refused snippet), the --help rows and agent section in src/cli-style.ts, docs/AI.md, examples/break-web/help.ts and docs/site/break, and grep every old pointer; regenerate docs/reference — see S3 — docs
        status: pending
      - id: measure
        content: Measure the compile-time cost of always recording panic sites on src/compile.ts, interleaved runs with a noise band, for the Measured trailer — see S3 — measurement
        status: pending
---

## Context

Today the no-panic check is opt-in: `--deny-panics`, or a `"nish": { "noPanic": [...] }` list in the root `package.json`, puts modules in scope ([`src/compilation.ts`](../../src/compilation.ts) `readNoPanic`, about line 1695; [`src/options.ts`](../../src/options.ts) `denyPanics`, `recordsPanics()` line 400). The flag changes no byte of IR; it only decides whether the build happens. The requirement is to flip the default so every module of the root package is in scope unless the build passes `--allow-panics`, the only way to relax it. This is a breaking change (`feat(cli)!`); the project stays on 0.x.

The full requirements, the measured facts (examples refused today, the `amritk/vector` figures, the known prover gaps, the seed rejecting the flag) and the decided design are the requirements document this plan was drawn from; every stage worker gets it verbatim and its rules are binding. Summarised here only where a stage needs it.

## Approach

- **Three PRs, not one.** S1 adds the flag while the default is still lax, so `--allow-panics` is a no-op (scope = the `noPanic` list, as today without a flag) and every harness change is green on its own. S2 makes the examples pass `--deny-panics`, which is what the default will be, in parallel with S1. S3 starts once both have merged and flips the default; its diff is then the rule, its wording, its tests and its docs, not hundreds of harness edits.
- **One probing helper per language** decides who gets `--allow-panics`: pass it to a compiler only if that compiler's `--help` lists it. Never hard-code "the seed never gets it" — a `NISH_BOOTSTRAP` seed can be any release, and after the next release the seed accepts it. The helper's comment says it can go once every supported seed accepts the flag.
- **The flag's name is provisional.** One constant (in [`src/compile.ts`](../../src/compile.ts) or [`src/options.ts`](../../src/options.ts)); the help row, the diagnostic wording and the test helpers read it from there or from one place each.

## S1 — the flag

**Owns:** `src/compile.ts`, `src/options.ts`, `src/cli-style.ts`, `scripts/**`, `tests/**` except `tests/runtime-budgets.js`, `bench/**`, `.github/workflows/**`, `.github/actions/**`, `docs/guide/using-nish/cli.md`, `.claude/testing.md`, `.claude/selfhost.md`. Generated: `tests/self/goldens/checked/**`, `docs/reference/**`, `tests/link/*/expected.caps.json`. Depends on: nothing. Runs concurrently with S2.

- Parse `--allow-panics` next to `--deny-panics`. Both on one command line: the last one wins, unless the CLI already has a convention for opposing flags — then follow it and say so in the PR body.
- Semantics in S1: `--allow-panics` means "no default scope" — exactly today's no-flag behaviour. A `noPanic` list holds under it.
- `--emit-ast` with `--allow-panics` is fine; with `--deny-panics` it stays a usage error (exit 2).
- Help row in [`src/cli-style.ts`](../../src/cli-style.ts) (`menu.row("--deny-panics", ...)`, about line 93). The agent section and the reworded `--deny-panics` row are S3's.
- [`docs/guide/using-nish/cli.md`](../../docs/guide/using-nish/cli.md): the flag, stated as what it will mean once the default flips is S3's — in S1 say what it does today. Regenerate [`docs/reference/`](../../docs/reference/) (`node scripts/gen-reference.mjs`).

## S1 — the helpers

- **Shell:** one function (candidate home: [`scripts/nish-compiler.sh`](../../scripts/nish-compiler.sh) if it is already sourced as a shared library, otherwise a new sourced file) that probes a binary's `--help` once and prints `--allow-panics` or nothing. `scripts/bootstrap.sh`: stage1 is built by the seed (lax by default) — it still goes through the helper; stage2 and stage3 are built by the new compiler and get the flag through it. Check [`scripts/ddc-chain.sh`](../../scripts/ddc-chain.sh), the users of [`scripts/fetch-seed.sh`](../../scripts/fetch-seed.sh), [`scripts/build.sh`](../../scripts/build.sh), `npm run sync-main`, the release build and every other script that compiles `src/`, `std/` or a test program.
- **JS:** one module every test script imports, caching the probe per binary path. It adds `--allow-panics` unless that call's own arguments decide the scope (`--deny-panics`, or a program whose test is about `noPanic`). Route the ~266 `spawnSync(NISH, ...)` sites in [`tests/run.js`](../../tests/run.js), and `tests/ffi-*.js`, `tests/differential/*`, `tests/self/*`, [`tests/nish-cmp.js`](../../tests/nish-cmp.js), [`tests/panics-oracle.js`](../../tests/panics-oracle.js), `tests/c-import/`, `tests/wipes/`, `tests/break-web/`, and every other spawner found. Check any test that asserts a compiler's exact argument list (`tests/run.js` around line 1457, `const allowed = [...]`).
- **`tests/link/`** (about 155 packages with their own `package.json`): find how their runner builds them and make sure the helper reaches it. The no-panic link tests (`no_panic_*`, `caps_policy_manifest_*no_panic*`, `deny_retention_dependency`) must still test what they test.
- **Examples stay strict:** the examples section, the `examples/hello.ts` / `examples/multi/main.ts` builds in the self-hosted compiler section (around line 9125), the performance ratchet (around line 8207) and [`scripts/smoke.sh`](../../scripts/smoke.sh) pass no `--allow-panics`. S3 adds it visibly for the opt-outs.
- **CI:** `.github/workflows/*` and `.github/actions/*`, `bench/`, `tests/host-import`: same rule — lax where the program is not meant to be panic-free, strict where a user would copy it.
- Adding the flag moves no IR: stage2 = stage3 and every golden must stay byte-identical (`bash scripts/bootstrap.sh --verify`). The rolling freeze holds: `src/` uses nothing new.

## S1 — tests

Each holds before and after S3, so it lands here. Show the exact LLVM IR for every TypeScript snippet added (CLAUDE.md).

- The probe: a compiler whose `--help` does not list the flag (the seed, or a stub script) is never passed it; one that lists it is.
- Both flags: `--deny-panics --allow-panics` vs `--allow-panics --deny-panics` (or the chosen rule).
- `--emit-ast` without a flag builds; with `--deny-panics` exits 2 (existing check near tests/run.js line 25338 stays).
- A `noPanic` list under `--allow-panics` refuses the listed module and accepts the rest.
- A positive program: IR byte-identical with no flag, `--allow-panics` and `--deny-panics`.
- Existing `tests/cases/reject_deny_panics_*` and `deny_panics_*` pass unchanged.

## S2 — survey

**Owns:** `examples/**` except `examples/break-web/help.ts`, `tests/runtime-budgets.js`, `README.md`, `docs/INSTALL.md`, `web/**`, `docs/guide/**` except `docs/guide/using-nish/cli.md` (only pages that quote an example this stage changes). Generated: `tests/self/goldens/checked/examples/**`. Depends on: nothing. Runs concurrently with S1.

Build every example with the compiler from `src/` under `--deny-panics` and the flags it is really built with: `examples/*.ts`, `examples/*/main.ts`, and the directories with their own build (`api-cli`, `game-starter`, `http-app`, `relay`, `wasm-arena`, `multi`, `break-web`). Per-example number modes are in [`tests/run.js`](../../tests/run.js) around lines 6427-6460; some examples carry a `// smoke:` line. Expected refusals (seed 0.42.0 survey): `add.ts`, `argv.ts`, `arrays.ts`, `math.ts`, `sets.ts`, `wordcount.ts`. Put the survey result (example → refused sites by kind) in the PR body.

## S2 — fixing an example

- Prefer a guard the prover reads (`if (i < 0 || i >= xs.length) { ... }`, a loop bounded by `xs.length`), a type that states the intent (`u32` where wrapping is meant, `integer<Lo, Hi>` where a range is), or `Result` / `readFileSyncOrNull` / `orReturn` instead of `expect`, `panic` or `readFileSync`.
- Never `wrappingAdd` / `uncheckedGet` from `nish:unsafe`, and never a guard that returns a made-up value such as `0`. A guard handles the bad case for real: report it, return an error, or skip it.
- The known prover gaps (a named-constant or `toU64(0)` guard, `x & mask`, `charCodeAt`, down-counting loops) are not fixed here; write around them in a way the guide would teach, or opt out.
- Every example keeps the same stdout; its `tests/run.js` checks prove it. Regenerate the example goldens (`node tests/self/goldens.js --update`) and move any pinned size or budget ([`tests/runtime-budgets.js`](../../tests/runtime-budgets.js)) only with the measured reason in the PR body.

## S2 — examples/add.ts

`export const add = (a: number, b: number): number => a + b` is refused for `overflow`. Decide whether it takes a ranged type, returns a `Result`, or is the documented opt-out — pick what the guide can explain in one sentence. Move every quote of it ([`README.md`](../../README.md), `docs/guide/` pages other than `using-nish/cli.md`, [`docs/INSTALL.md`](../../docs/INSTALL.md), [`web/`](../../web/), `package.json`'s `example` script output is unaffected).

## S2 — opt-outs

An example refused only for a call into `std/` (expected: `sets.ts`, `wordcount.ts` — `Map`, `Set`, `trim`, `split`, JSON reads) cannot be fixed here. It gets a comment naming the reason and the follow-up (making `std/` panic-free). S3 passes `--allow-panics` where it is built. List them in the PR body; S3's worker reads that list from the merged PR.

## S3 — the scope rule

**Owns:** `src/**`, `tests/**`, `scripts/**`, `docs/**`, `examples/**`, `.github/workflows/**`, `.github/actions/**`, `bench/**`, `web/**`, `llms.txt`, `skills/**`, `runtime/nish.d.ts`, `.claude/*.md`, `CLAUDE.md`, `AGENTS.md`, `README.md`. Not `std/**`. Generated: `tests/self/goldens/checked/**`, `docs/reference/**`, `tests/link/*/expected.caps.json`, `docs/site/break/**`. Depends on: S1 and S2 merged before it starts (it consumes S1's flag constant and helpers, and S2's opt-out list).

In `Compilation.readNoPanic`:

1. Default: every module with `unit.packageName === ROOT_PACKAGE` is in scope. Dependencies and `std/` are not, but a call from a scoped module into one that may panic is still a `call` site.
2. `--allow-panics`: scope = the root package's `"nish".noPanic` modules, or nothing.
3. `noPanic` keeps its meaning and syntax; NL3031 stays; no manifest value (including `[]`) relaxes the default.
4. `--deny-panics` stays: the default spelled out.
5. `--emit-ast`: keep refusing explicit `--deny-panics`; skip the default check silently ([`src/compile.ts`](../../src/compile.ts) about line 1422).
6. `nish run`, `--emit-ts`, `--compat` and every other checking path: strict by default; a path that differs carries a written reason in the code.

`recordsPanics()` becomes true for every default build. That is the compile-time cost to measure.

## S3 — wording

Every scope diagnostic (NL2457, NL2458 and siblings in [`src/codes.ts`](../../src/codes.ts), [`src/panics.ts`](../../src/panics.ts)) says how to relax it, reading the flag name from the S1 constant. Default scope, e.g. "a module of this package is held to no panic by default; `--allow-panics` relaxes the modules `noPanic` does not list". Listed module: says it is in scope because `noPanic` lists it, which `--allow-panics` does not relax. Grep the old wording across the repo and regenerate every pinned copy from the compiler: `tests/wordings/*.err`, `tests/link/*/expected.err`, `expected.json`, `docs/reference/diagnostics/`.

## S3 — tests

- `tests/link` package with no `noPanic` key and no flag: refused with the new wording (`expected.err`) — the negative for the changed default.
- The same program under `--allow-panics` builds; its IR shown in the PR.
- A `noPanic` list under `--allow-panics`: listed module refused with the listed-module wording, the rest accepted.
- `"noPanic": []` under the default: still refused.
- Regenerate any `tests/link/*/expected.caps.json` that moves.

## S3 — examples

For each opt-out listed in the merged S2 PR, pass `--allow-panics` visibly where it is built or run: the examples section of `tests/run.js`, [`scripts/smoke.sh`](../../scripts/smoke.sh), the CI `examples` job. Every other example is built with no flag.

## S3 — docs

- [`docs/LANGUAGE.md`](../../docs/LANGUAGE.md) → "Panic sites" (about line 16028): the scope rule, normative.
- [`docs/guide/using-nish/cli.md`](../../docs/guide/using-nish/cli.md) and every guide page that shows `--deny-panics` or a snippet the default now refuses: the default, `--allow-panics`, and what `noPanic` still does under it. Guide snippets are compiled by a test (markers like `<!-- nish:err NL2456 --deny-panics -->`, tests/run.js about line 28612): every snippet a user would copy compiles under the default or says why it opts out.
- [`src/cli-style.ts`](../../src/cli-style.ts): reword the `--deny-panics` row, and add the agent guidance — keep the default strict, fix refusals rather than relaxing, never silence one with `nish:unsafe` or a fake guard. Same guidance in [`docs/AI.md`](../../docs/AI.md).
- Grep the old answer ("opt-in", "`--deny-panics` or `noPanic`", "`--deny-panics` puts all of them in") across `docs/`, `.claude/`, `CLAUDE.md`, `llms.txt`, `skills/`, `runtime/nish.d.ts` and source comments; update every pointer.
- [`examples/break-web/help.ts`](../../examples/break-web/help.ts) mentions the flag; rebuild `docs/site/break/` with `examples/break-web/build.mjs` if its help text changes.
- `node scripts/gen-reference.mjs`, then `--check`.

## S3 — measurement

Compile [`src/compile.ts`](../../src/compile.ts) (the compiler's own entry) with recording forced on vs off, interleaved, enough runs for a noise band (`.claude/testing.md` → "A `Measured:` trailer"). The PR's commit carries `Measured:`, `Refs: docs/LANGUAGE.md#panic-sites`, `Tests:`, and a `BREAKING CHANGE:` body naming the default, `--allow-panics` (a `noPanic` list still holds under it), the `std/` limitation (a strict module cannot yet call `Map`, `Set`, `trim`, `split` or JSON reads), and the `amritk/vector` figures (2,459 errors on 2,065 lines in 92 files) as the scale of the break.

## Out of scope

Each is recorded as a follow-up in the S3 PR body:

1. The prover gaps: named constants and converted literals, `&` masks, `charCodeAt`, down-counting loops.
2. Making `std/collections.ts`, `std/text.ts`, `std/json.ts`, `std/array.ts`, `std/regex.ts`, `std/sort.ts` panic-free or proven so a strict module can use them.
3. Reporting every `nish:unsafe` import a strict build relies on.
4. A migration note for downstream projects such as `amritk/vector`: add `--allow-panics`, then list modules in `noPanic` one at a time, then drop the flag.
5. Renaming `--allow-panics`.

## Verification

Each stage's `verification` line, plus `node tests/self/goldens.js --update` and reading the diff, and nish-cmp if any corpus program's IR moves (S1 and S3 should move none; S2 moves only examples). CI's nine `test` shards answer for the rest, each shard's skip count read.
