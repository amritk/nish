# R6 inventory — every stage0 consumer and its disposition

Companion to [r6-stage0-deletion.plan.md](r6-stage0-deletion.plan.md). Line numbers are against `main` at `d54ea7c`; re-find them, do not trust them. Dispositions: **Repoint** (onto stage1 / the seed), **Delete**, **Text** (prose or comment), **Keep**. Where this file and the plan disagree about *ownership*, the plan wins.

## tests/run.js (harness stage)

Core: `const cli = path.join(root, "dist", "index.js")` (:45), ~65 call sites; `seedSpec = NISH_BOOTSTRAP || dist` (:171).

| Section (lines) | stage0 use | Disposition |
|---|---|---|
| Imports :36-38 | `stage1_only.js`, `parity.js`, `batch_compile.js` | Delete imports; keep `nish-cmp.js`, arrowify, arrow-verify |
| `--parity` :323-345 | spawns `tests/self/parity.js` | Delete |
| A. Goldens :347-553 | every case compiled by stage0 in process; stage1 only for register cases; fixture compiled twice | Repoint: one stage1 at `build/nish-test` via `seedForOracle`, per case through `tests/pool.js`; delete register handling and the fixture's second compile |
| Batch gate :555-595 | in-process batch vs CLI, `--verify-batch`, `--batch-gate-only` | Delete, with `tests/batch_compile.js`, `tests/batch_worker.js` |
| WP10 diagnostics :647-760 | cli spawns, syntax-error wording (:671, :750) | Repoint; stage0 wordings re-read from stage1 |
| Stable codes :762-845 | `gen-diagnostic-codes --check`; src vs self registry equality (:794-830) | Keep `--check`; delete equality; reader self-tests run on `self/codes.ts` |
| Coverage over stage0 :849-900 | `diagnostic_coverage.js --compiler dist`, `UNCODED_BACKLOG = 4` | Delete; move `--update` and cap onto stage1 run (:5776-5792); cap = 5 |
| WP15/WP5/WP21/WP18/WP4/WP6 :1019-2300 | cli spawns, some with cwd outside repo (:1714-1721, :1776, :1806, :1834) | Repoint; binary must live at `build/<name>` (packageRoot climbs from argv[0]) |
| Allocating builtins :2319-2445 | imports `dist/codegen/emit/expressions.js`, `dist/codegen/runtime.js`, reads `src/codegen/escape.ts` | Rewrite as a guard over stage1 `--runtime-decls` and `self/escape.ts` `isAllocatingBuiltin` |
| Layout/pipeline/runtime/wasm :2515-3025 | web check compiles `self/compile.ts --profile wasi` with stage0 (:2990-3017) | Repoint to stage1 (wasi profile exists, `self/compile.ts:65,72-74`) |
| Nish harnesses :3201-3270 | `tests/nish/{run,cli}.ts` built by stage0 | Repoint; pass stage1 path as argv |
| WP8 interop :3273-4680 | `RUNTIME_FUNCTIONS` from `dist/codegen/runtime.js` (:3290); `tsc` on `.d.ts` | Guard onto stage1 `--runtime-decls`; `tsc` stays (checks user `.d.ts`) |
| WP0 validator timing :4680-4722 | `require("typescript")` + `dist/validator.js` | Delete (it timed stage0) |
| Parity selector :4723-4860 | tests `parity.js changedPrograms` | Delete |
| WP14 self-hosting :4860-6204 | compiles self/* with stage0 (:4892), dumpers (:5020, :5054), six oracles (:5093-5150, :5204, :5351), `packageRootOf(dist)` (:5250), fuzz `--stage1` (:5302), parity `--flags-only` (:5341), bootstrap.js (:5369), stage0-seed bootstrap.sh (:5419-5460), "theirs" comparisons (:5563-5900), "answers the way stage0's does" (:5938-6086), §7a (:6086-6204) | Repoint compiles/dumpers; delete oracle runs, flags-only parity, stage0-seed checks, "theirs" comparisons (keep stage1-side assertions); perturbed-seed check wraps the real seed; nish-cmp / fuzz `--stage1` stay gated on `NISH_BOOTSTRAP` |
| WP9 bench :6204-6360 | `bench/run.mjs --validate` | Pass `--compiler` |
| WP12 exit codes :6360-6556 | `NISH_SIMULATE_ICE` (:6452, :6498, :6510) | Repoint onto the ported self/ hook |
| WP16 ambient :6556-6705 | `tsc` against `runtime/nish.d.ts` | Keep |
| AI.md snippets :6705-6786 | cli (:6766) | Repoint |
| WP12 package :6787-7563 | `require("typescript")` parses shipped-script imports (:6894-6945); "npm pack excludes src/index.ts" (:7138) | Keep parser (devDependency); drop the src line. :6922-6945 fails once typescript leaves dependencies unless `scripts/arrowify.mjs` is excluded from `files` (deletion stage) |
| Seed targets :7657+ | `resolveTarget` from `dist/codegen/target.js` (:7674); realpath probe via dist (:8001) | Parse `self/target.ts` or ask stage1; probe with stage1 |
| Prose claims :8500-8515 | reads INSTALL, wp10, wp12, wp19 for version claims | Keep; rules stage must keep the phrasings |
| G6 ddc :8803-9162 | drives `ddc-tag.sh`, checks release.yml ddc wiring | Delete |
| stage3 == stage2 :9162-9396 | verify-binaries | Keep |
| WP22 x WP13 :9570-9628 | arrow-parity.js, `differential/goldens.js` full | Delete arrow-parity; call `goldens.js --fresh` |
| WP22 §2 :9628-10062 | cli over `tests/differential/arrow-parity/*.ts` | Repoint; keep fixtures |
| WP13 differential :10062-10153 | `run.js --quick`, `unmodified.js`, fuzz vs Node (:10135) | `--compiler <stage1> --frozen`; delete fuzz-vs-Node |

## Goldens that change when section A moves to stage1

- the 89 `reject_*.err` named in `tests/self/parser_refusals.txt` take the register's second column (stage1's sentence); the register empties;
- `tests/cases/dump_ast.stdout` takes stage1's tree format (`tests/self/dump_ast.golden` already is);
- `dump_checked*.stdout`: normalise `${root}/` (stage1 prints the path as given).
Any other golden that changes is a finding, not an update.

## Other files

| File | stage0 use | Disposition (stage) |
|---|---|---|
| `tests/self/{types,diagnostics,symbols,checked,ir,interop}_oracle.js` | the six | Delete (deletion). Replaced by `tests/self/goldens/*` and `tests/nish-cmp.js` |
| `tests/self/parity.js`, `stage1_only.{js,txt}` | parity, register | Delete (deletion); harness stops reading them |
| `tests/self/bootstrap.js` | stage0 is the only seed (:47, :122-146) | Seed from `seed.js`; `IR(stage1)==IR(stage2)`, `stage3==stage2` (harness) |
| `tests/self/seed.js` | dist fallback (:47, :101-121) | Add `build/seed` slot (seed-plumbing); remove fallback (deletion) |
| `tests/self/support_oracle.js` | irEscape, f64Hex, nishExportTarget, parseBareSpecifier from dist (:43-67, :140-185) | Record as `tests/self/goldens/support.txt` while dist exists (tools) |
| `tests/self/reject_oracle.js`, `parser_refusals.txt` | register of stage1 sentences | Empties with the .err rewrite (harness) |
| `tests/nish-cmp.js` | builder falls back to dist (:477) | Seed only (tools) |
| `tests/diagnostic_coverage.js` | candidate `dist/index.js` (:229); `stage0_only.txt` mechanism (:100, :405-540) | Drop dist; fold `stage0_only.txt` into `unreachable.txt` (tools, merges after harness) |
| `tests/differential/{lib,run,goldens,fuzz,unmodified}.js` | fallbacks (lib.js:133-159, fuzz.js:324,434), live rewriter, fuzz default mode | Seed/`--compiler`, frozen only, freshness only, no default fuzz mode, register of programs with no frozen rewrite (tools) |
| `tests/differential/{rewrite,arrow-parity}.js` | `dist/compiler.js` | Delete (deletion) |
| `tests/nish/run.ts` (:70, :233, :687), `tests/nish/cli.ts` (:76, :215, :566-581) | default `dist/index.js`, ICE keyed on Node entry | Compiler as argv, defaults unchanged, probe for ICE hook (seed-plumbing) |
| `scripts/bootstrap.sh` | unset seed = stage0 (:22-25, :216-246, :363-) | Fetched seed or clear error (deletion; release.yml depends on it until then) |
| `scripts/gen-diagnostic-codes.mjs` | scans `src/` (:117), reads `src/codes.ts` (:52, :184-189) | Freeze: `self/codes.ts` hand-kept, `--check` validates format/uniqueness (tools) |
| `scripts/arrow-verify.mjs` | dist (:298, :377, :680) | `--compiler`, default `build/nish` (tools) |
| `scripts/arrowify.mjs` | `import ts from "typescript"`, ships | `!scripts/arrowify.mjs` in `files` (deletion) |
| `scripts/smoke.sh` (:55), `docs/cookbook/regen.sh` (:9, :29, :42), `bench/{run,worker,ffi}.mjs` | dist | `NISH` / `--compiler` override (seed-plumbing) |
| `package.json`, `tsconfig.json`, `biome.json` (:10, :134), `.gitignore` (:16) | tsc, dist, src | deletion |
| `ci.yml` test (:210-250), bootstrap CLI contract (:445-456), runner (:595-640), batch-parity (:664-713), parity-select/changed (:779-960); `parity.yml` | dist, parity | harness |
| `release.yml` binaries (:209-212), ddc (:395-448, needs :452); `.github/ddc-tag.sh` | stage0 seeds the chain; ddc | deletion |

## The six oracles and their successors

| Dies | Compared | Successor |
|---|---|---|
| `types_oracle.js` | `self/types.ts` vs `src/types.ts` | `tests/self/goldens/types.txt` |
| `diagnostics_oracle.js` | vs `src/diagnostics.ts` | `goldens/diagnostics.txt` |
| `symbols_oracle.js` | vs `src/checker/scope.ts` | `goldens/symbols.txt` |
| `checked_oracle.js` | stage0 `--emit-checked` | `goldens/checked.txt` + `checked_self.txt` |
| `ir_oracle.js` | stage0 IR | `tests/nish-cmp.js` + `tests/cases/*.ll` |
| `interop_oracle.js` | stage0 sidecars | `nish-cmp.js` `sidecarFlags` |

Fixtures `tests/self/{types,diagnostics,symbols}.ts` and `diagnostics_{fixture,second}.txt` survive — `goldens.js` builds them.

## Two Markdown links into src/

`README.md:211` and `docs/wp12-release.md:583`; `docs/check-links.mjs` is a CI gate, so the rules stage repoints both.
