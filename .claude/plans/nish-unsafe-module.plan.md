---
name: nish:unsafe — per-site unsafe functions replace the program-wide flags
overview: Add a builtin module nish:unsafe (uncheckedGet, uncheckedSet, wrappingAdd/Sub/Mul over i32 and i64), confine --unchecked-indexing and --wrapping to the entry package with a deprecation warning, and record every nish:unsafe import as a fact a capability report can read. One stage, one PR — src/ and the generated goldens cannot be split across concurrent PRs without conflicting.
stages:
  - id: unsafe-module
    title: feat(checker) — nish:unsafe replaces the program-wide unsafe flags
    goal: Every unchecked index and every defined wrap is visible at its call site, and no flag reaches into a dependency
    verification: npm run check && npm run lint && node scripts/gen-diagnostic-codes.mjs --check && npm test (undegraded, no DEGRADED banner, skip count read and reported)
    todos:
      - id: module-table
        content: Add nish:unsafe to isNishModule, nishModuleNames, nishModuleExports and nishExport in src/nish-modules.ts — see Module surface
        status: pending
      - id: builtin-check
        content: Check uncheckedGet/uncheckedSet/wrappingAdd/wrappingSub/wrappingMul in src/builtins.ts (arity, element/index types, T extends i32 or i64 as ctSelect does), new NL codes in src/codes.ts — see Module surface
        status: pending
      - id: builtin-emit
        content: Lower the five functions in src/emit-builtins.ts — no bounds compare for unchecked access, plain add/sub/mul without nsw for wrapping — see Lowering
        status: pending
      - id: runtime-decls
        content: Declare the five functions in runtime/nish.d.ts and implement them in runtime/nish.mjs as xs[i], xs[i] = v, (a + b) | 0 and the BigInt.asIntN(64, …) i64 forms — see Module surface
        status: pending
      - id: unsafe-facts
        content: Record each nish:unsafe import and call site as a checker side-table fact (module, functions imported, call-site node ids and positions) in src/program.ts — see Unsafe facts
        status: pending
      - id: flag-scope
        content: Make --unchecked-indexing and --wrapping apply only to modules of the entry package, never to node_modules packages or std (nish/) modules — see Flag scoping
        status: pending
      - id: flag-deprecation
        content: Print a deprecation warning in the performance band (NL9xxx, next free code) for each flag, naming the nish:unsafe function to use — see Flag scoping
        status: pending
      - id: migrate-tests
        content: Move tests that use the flags as a means rather than as their subject to nish:unsafe, and update the std/crypto comments that cite the flags — see Migration
        status: pending
      - id: goldens-and-negatives
        content: Add golden .ll, native round trip, Node run, and negative cases (wrong arity, wrong type, use without import, dependency not affected by the flag) under tests/cases and tests/link — see Tests
        status: pending
      - id: docs
        content: Write the docs/LANGUAGE.md rule, the docs/AI.md line, the docs/IR_COOKBOOK.md entry showing uncheckedGet emits no icmp, AGENTS.md code table row if required, and regenerate tests/self/goldens via node tests/self/goldens.js --update — see Docs
        status: pending
---

# nish:unsafe — per-site unsafe functions replace the program-wide flags

## Stage unsafe-module

**Owns:** `src/**`, `runtime/nish.d.ts`, `runtime/nish.mjs`, `std/**`, `tests/**`, `docs/**`, `SECURITY.md`, `README.md`, `AGENTS.md`, `CHANGELOG.md`. Not `.github/**`, not `package.json`, not `biome.json` / `tsconfig.json`, not `scripts/**`.

## Context

`--unchecked-indexing` and `--wrapping` are program-wide. They are read off `Options` in roughly thirty places ([src/emit-arrays.ts](src/emit-arrays.ts), [src/emit-strings.ts](src/emit-strings.ts), [src/emit-builtins.ts](src/emit-builtins.ts), [src/attributes.ts](src/attributes.ts), [src/bounds.ts](src/bounds.ts), [src/ranges.ts](src/ranges.ts), [src/constants.ts](src/constants.ts), [src/emit-ops.ts](src/emit-ops.ts) via `opts.nsw`), so one flag on the command line makes every out-of-range index in every module — dependencies and `nish/` std included — undefined behaviour, and nothing in the source shows it. The work stream's bar is that no program has UB without a visible opt-in.

## Approach

- **One stage.** Every todo moves `src/`, and every `src/` change moves `tests/self/goldens/checked*.txt`; two concurrent PRs here would conflict by construction ([CLAUDE.md](CLAUDE.md), generated goldens).
- **A builtin module, not new syntax.** `nish:unsafe` is wired exactly as `nish:fs` / `nish:net` are in [src/nish-modules.ts](src/nish-modules.ts): the import renames a builtin. The functions are also globals in `runtime/nish.d.ts` as every `nish:` export is — but see Unsafe facts: use **without** the import is refused, so the opt-in is always a visible `import … from "nish:unsafe"`.
- **Generic like `ctSelect`.** `wrappingAdd<T extends i32 | i64>(a: T, b: T): T`, same for Sub/Mul; both operands one type, as `ctSelect`'s check in [src/builtins.ts](src/builtins.ts) enforces.
- **Flag scoping by package.** "Entry package" = modules whose `packageDirOf` equals the entry's (`Compilation.rootPackageDir`, [src/compilation.ts](src/compilation.ts)) **and** that are not `nish/` std modules. std is shipped code the author did not write, so it is a dependency for this rule.
- **Deprecation in the performance band.** NL9xxx warnings are on by default (portability is behind `--warn-portability`), so a deprecation there is actually seen. Takes the next free NL9 code.
- **The rolling freeze.** `src/` must not itself import `nish:unsafe` (the seed does not know it). Nothing in this plan needs it to.

## Module surface

```ts
// runtime/nish.d.ts
declare function uncheckedGet<T>(xs: T[], i: i32): T;
declare function uncheckedSet<T>(xs: T[], i: i32, v: T): void;
declare function wrappingAdd<T extends i32 | i64>(a: T, b: T): T;
declare function wrappingSub<T extends i32 | i64>(a: T, b: T): T;
declare function wrappingMul<T extends i32 | i64>(a: T, b: T): T;
```

- `nishModuleExports("nish:unsafe")` → `"uncheckedGet, uncheckedSet, wrappingAdd, wrappingSub, wrappingMul"`; `nishModuleNames` grows by one (the `.err` goldens that list the modules move — regenerate, never hand-edit).
- Checker: arity and types are checked like any builtin; each failure is a new NL2xxx code (next free in the checker band) unless an existing generic "wrong arity"/"wrong type" code already covers builtins — reuse those where the existing builtins do.
- Element types: decide and document which `T[]` receivers are allowed (at least every numeric array and `u8[]`); a receiver kind the emitter cannot lower without a check is refused, not silently checked.
- `runtime/nish.mjs`: `uncheckedGet = (xs, i) => xs[i]`, `uncheckedSet = (xs, i, v) => { xs[i] = v }`, `wrappingAdd = (a, b) => typeof a === "bigint" ? BigInt.asIntN(64, a + b) : (a + b) | 0`, Sub likewise, Mul uses `Math.imul` for i32. Follow how [runtime/nish.mjs](runtime/nish.mjs) already provides `ctSelect`.

## Lowering

- `uncheckedGet(xs, i)`: the same GEP + load `xs[i]` lowers to when `opts.uncheckedIndexing` is on — no `icmp`, no branch to the bounds panic. Reuse the existing unchecked path in [src/emit-arrays.ts](src/emit-arrays.ts) rather than writing a parallel one.
- `uncheckedSet(xs, i, v)`: the store twin.
- `wrapping*`: `add` / `sub` / `mul` with no `nsw`, whatever `opts.nsw` says ([src/emit-ops.ts](src/emit-ops.ts) `intOpcode`).
- [src/attributes.ts](src/attributes.ts): an `uncheckedGet` call is not a panic site; an `uncheckedSet` writes its receiver. Make the fixpoint read them correctly — **no attribute without a proof**.
- Constant folding ([src/constants.ts](src/constants.ts)): `wrappingAdd` of two constants folds wrapping, never reports NL-overflow.

## Unsafe facts

- A side table on `Program` ([src/program.ts](src/program.ts)), filled by the checker, read by nobody yet except tests and `--emit-checked`: per module, the `nish:unsafe` import (module path, import line/column), the names imported, and every call site (node id, line, column, function name).
- Visible through `--emit-checked` so the regenerated `checked.txt` golden pins it, and so a later capability report (`--json` or a sidecar) only has to print it.
- A call to one of the five names **without** importing it from `nish:unsafe` is refused with a new NL2xxx code ("`uncheckedGet` is in `nish:unsafe`; import it …"). Without this rule the global spelling would be an invisible opt-in, which is the thing this work removes. This is the safe direction (tsc accepts, Nish refuses).

## Flag scoping

- Replace each `opts.uncheckedIndexing` / `opts.nsw` / wrapping read on a per-function path with a per-module answer: the emitter and checker already know which module a function belongs to; add `Module.uncheckedIndexing` / `Module.wrapping` (or the equivalent on `CheckContext`, [src/context.ts](src/context.ts)) set to `opts.x && isEntryPackage(module)`. `ranges.ts:225` reads `contexts[0]` — make it per context.
- Deprecation: one warning per flag per compilation (not per module), NL9xxx, text names the replacement — e.g. `--unchecked-indexing is deprecated and applies only to the entry package; use uncheckedGet/uncheckedSet from nish:unsafe at each site`. Likewise `--wrapping` → `wrappingAdd/wrappingSub/wrappingMul`. Silenced by `--no-warn-performance` like the rest of the band. `--json` carries the code.
- [src/dump-checked.ts](src/dump-checked.ts) and [tests/self/corpus.js](tests/self/corpus.js) pass `--wrapping` through: keep that working.
- `run-cache.ts`: the cache key must still distinguish flag on/off.

## Migration

| Test | Uses the flag as | Action |
| --- | --- | --- |
| `arr_unchecked`, `opt_wrapping`, `const_wrap`, `perf_overflow_wrapping`, `port_num_wrap_wrapping`, `arr_range_call_wrap`, `net_tcp_unchecked`, `net_udp_unchecked`, `i64_basic` | its subject | keep the flag; the golden stderr now carries the deprecation warning |
| `ct_asm_*` (aes, chacha20poly1305, k1_base64url, k1_ct, mac, p256, x25519, refused) | a means — no branch from a bounds check | move to `uncheckedGet`/`uncheckedSet` at the indexing sites and drop the `.args`, **if** the asm check stays green; the copies must still behave as [std/crypto](std/crypto) (tests/link/crypto_* pin that) |
| `tests/differential/corpus/*.args` with `--wrapping` | defined i32 wrap vs JS | keep where the case is about the flag's semantics; move to `wrapping*` where the wrap is incidental. Worker's call, stated per file in the PR body |

- [std/crypto/sha256.ts](std/crypto/sha256.ts) and [std/crypto/x25519.ts](std/crypto/x25519.ts) cite the flags in comments; update them (the flag no longer reaches std). No std code changes behaviour.

## Out of scope

- Removing the flags (a later release).
- Making default signed overflow defined or checked (default `nsw` remains; that is a separate work-stream item).
- The capability report itself — only the fact it will read.
- `src/` adopting `nish:unsafe` (rolling freeze).

## Tests

- Golden `.ll` + `llvm-as` + native round trip with expected stdout: `unsafe_get_set` (uncheckedGet/Set on `i32[]`, `u8[]`, `f64[]`; the cookbook shows its IR has no `icmp`), `unsafe_wrapping` (i32 and i64 add/sub/mul at INT_MAX/INT_MIN, printed).
- Negatives (`.err` goldens): `reject_unsafe_arity`, `reject_unsafe_type` (mixed `i32`/`i64` operands, `u32` operand, non-array receiver, `f64` index), `reject_unsafe_no_import` (global spelling refused).
- Flag scope: a `tests/link/` case with a `node_modules/<pkg>` dependency indexing out of range: under `--unchecked-indexing` the dependency still panics with the bounds message while the entry's own access is unchecked; same for `--wrapping` (dependency keeps `nsw`, IR checked).
- Deprecation warning: a case with `--unchecked-indexing` and one with `--wrapping` whose stderr golden carries the NL9 warning; `--json` shape via [tests/nish/cli.ts](tests/nish/cli.ts) if the CLI contract test covers warnings.
- Node: the cases run under `runtime/nish.mjs` (the differential/Node runner) with the same stdout.
- Every TypeScript snippet the PR adds to tests has its exact LLVM IR shown in the PR body ([CLAUDE.md](CLAUDE.md)).

## Docs

- [docs/LANGUAGE.md](docs/LANGUAGE.md): a `nish:unsafe` section in the builtin-modules table (each function, its IR, its tests), the import-required rule, and the flags' new entry-package scope + deprecation in the CLI section and the integer table rows (lines ~157–160, 459, 471).
- [docs/AI.md](docs/AI.md): one line — unchecked access and defined wrap are `nish:unsafe` imports; the flags are deprecated. Its examples are compiled by `npm test`.
- [docs/IR_COOKBOOK.md](docs/IR_COOKBOOK.md): `a[i]` vs `uncheckedGet(a, i)` side by side.
- [SECURITY.md](SECURITY.md) lines ~77–79 and README "where it is not safe": point at `nish:unsafe`.
- `CHANGELOG.md` is generated from the commit ([CLAUDE.md](CLAUDE.md)); add a line only if the repo convention still asks for one.
- Commit: `feat(checker): …` with prose body and `Measured:` (e.g. a checksum loop with `uncheckedGet` vs `a[i]`), `Refs:`, `Tests:` trailers.

## Acceptance criteria

1. A program that does `import { uncheckedGet, uncheckedSet } from "nish:unsafe"` compiles, `tsc --strict` accepts it against `runtime/nish.d.ts`, it prints the same stdout natively and under Node, and the IR of the `uncheckedGet` call has no `icmp` and no branch to the bounds panic.
2. `wrappingAdd/Sub/Mul` on `i32` and on `i64` produce the two's-complement wrapped result at INT_MAX/INT_MIN natively and under Node, and their IR carries no `nsw`.
3. Calling any of the five without importing it from `nish:unsafe`, with the wrong arity, or with mismatched / non-i32-i64 operands is a compile error with a stable NL code.
4. Under `--unchecked-indexing`, an out-of-range index in a `node_modules` dependency (and in a `nish/` std module) still panics with the bounds message; under `--wrapping`, a dependency's signed arithmetic keeps `nsw`.
5. Each flag prints one NL9xxx deprecation warning naming the `nish:unsafe` replacement, visible in `--json` with its code.
6. `--emit-checked` (and so `tests/self/goldens/checked.txt`) shows, per module, the `nish:unsafe` import, the names imported, and every call site.
7. `docs/LANGUAGE.md` states the rule, `docs/IR_COOKBOOK.md` shows `uncheckedGet` emits no compare, `docs/AI.md` has the line, and `npm run check` + an undegraded `npm test` are green on `main` after merge.

## Verification

```bash
npm run check
npm run lint
node scripts/gen-diagnostic-codes.mjs --check
node tests/self/goldens.js --update   # then read the diff
npm test                               # read the summary: N passed, 0 failed, K skipped; no DEGRADED banner
```
