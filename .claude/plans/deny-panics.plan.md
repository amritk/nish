---
name: Prove a module cannot panic — --deny-panics and noPanic
overview: Make the checker record every way a compiled Nish program can panic as a site with a kind, write them per function to --emit-panics, and let --deny-panics (whole program) or package.json "nish".noPanic (chosen modules) turn every site still in scope into an NL2xxx error naming the kind and the guard that removes it.
stages:
  - id: panic-sites
    title: feat(checker) — record every panic site with its kind, and --emit-panics
    goal: Every panic path the emitter can produce is a recorded site (node, kind, function, proven or not), computed once after whole-program proofs, transitive through calls, and written per function by --emit-panics.
    verification: npm run check && npm test && npm run lint && npm run lint:dead && node scripts/gen-diagnostic-codes.mjs --check && node docs/check-links.mjs
    todos:
      - id: sites-model
        content: Add src/panics.ts with the PanicSite record and the kind list, and the per-module site list on CheckedProgram in src/program.ts — see Panic sites, The kinds
      - id: sites-collect
        content: Record candidate sites where the checker already sees each construct (bounds, division, range entry, panic, expect, new Array length, io-exit builtins, parallelMapInto, pop) — see Panic sites, Where each kind is recorded
      - id: sites-resolve
        content: Resolve sites after proveCallSiteRanges and checkParallel in Compilation.check — drop proven ones, honour --unchecked-indexing as not-a-proof, and compute may-panic through the call graph into call sites — see Panic sites, Resolution
      - id: emit-panics-flag
        content: Add --emit-panics FILE.json in src/options.ts and src/compile.ts, written beside the other sidecars, and its --help line and tests/nish/cli.ts contract — see The --emit-panics JSON
      - id: sites-oracle-test
        content: Add the IR oracle test that a function with no unproven non-oom site has no nish_panic_ call and no panic tail in its IR, over every tests/cases golden — see Tests
      - id: sites-tests
        content: Add tests/cases/panics_* goldens with .ll, .out and the expected JSON for each kind, then regenerate tests/self/goldens with node tests/self/goldens.js --update and read the diff — see Tests
      - id: sites-docs
        content: Add the Panic sites section to docs/LANGUAGE.md listing every kind, what proves it away, and why out-of-memory, stack overflow and signed overflow are not sites a proof can remove — see Docs
  - id: deny-panics
    title: feat(checker) — --deny-panics and package.json noPanic refuse every remaining panic site
    goal: Under --deny-panics (all of the program's own modules) or "nish".noPanic (the modules it lists), every unproven site in scope is an NL2416 or NL2417 error naming the kind and the guard; out-of-memory is reported in the JSON but allowed.
    verification: npm run check && npm test && npm run lint && npm run lint:dead && node scripts/gen-diagnostic-codes.mjs --check && node tests/diagnostic-coverage.js --require-coverage && node docs/check-links.mjs
    todos:
      - id: deny-flag
        content: Add --deny-panics to src/options.ts and src/compile.ts with its --help line and CLI contract entry — see Scope
      - id: nopanic-manifest
        content: Read the root package's "nish".noPanic list in src/manifest.ts and resolve it against the program's modules in src/compilation.ts, refusing an entry that names no module with NL3031 — see Scope
      - id: deny-codes
        content: Register NL2416 (site), NL2417 (call into a function that may panic) and NL3031 (noPanic entry names no module) in src/codes.ts, bump RULE_COUNT, add tests/wordings pins — see Diagnostics
      - id: deny-report
        content: Report every in-scope unproven non-oom site as an error with the kind and the guard, reusing the NL9007 guard wording for index and its siblings for range and slice — see Diagnostics
      - id: deny-tests
        content: Add the clean module (golden .ll + native round trip under --deny-panics) and one reject_deny_panics_<kind> per kind plus the noPanic link cases — see Tests
      - id: deny-docs
        content: Add the --deny-panics and noPanic rule to docs/LANGUAGE.md, the Proving it cannot panic recipe and a rule line in docs/AI.md, and the IR_COOKBOOK entry — see Docs
---

# Prove a module cannot panic

## Context

A compiled Nish program can stop with exit 1 from a dozen places the author never wrote `panic` at: a bounds check the checker could not prove away, a division, the entry check into `integer<Lo,Hi>`, `r.expect`, `readFileSync` on a missing file. Some of these the checker already proves away ([src/bounds.ts](../../src/bounds.ts) `nodeProvenIndex`, `nodeProvenRange`; [src/ranges.ts](../../src/ranges.ts) across calls), and the performance warning NL9007 tells the author which guard would do it — but only inside loops, only as a warning, and only for indexing. Nothing lets an author *require* that a module has no panic path left, and nothing lists the paths.

Facts this plan rests on (from the tree at `e2826b9`):

- The emitter's panic paths: `nish_panic_index` / `nish_panic_slice` / `nish_panic_div` ([src/runtime.ts](../../src/runtime.ts):685-713) and the panic tail `emitPanicTail` ([src/emit-builtins.ts](../../src/emit-builtins.ts):352) shared by `panic()`, `.expect`, range entry and the `new Array` length check. [src/attributes.ts](../../src/attributes.ts) already mirrors every one of them into `callsNoReturn` per function — the site list must agree with it.
- **Checked signed overflow has not landed**: `+ - *` lower to `nsw` (UB on overflow) unless `--wrapping`. It is therefore not a panic kind in this work; see Out of scope.
- **`--emit-capabilities` does not exist**, so this adds `--emit-panics <file.json>`.
- **The root package's own `package.json` is never read today** ([src/manifest.ts](../../src/manifest.ts):12, "Nothing else in the manifest is read"); dependency manifests are, by a narrow scanner. `noPanic` is the first root field.
- Next free codes: **NL2416**, NL3031 (`node scripts/gen-diagnostic-codes.mjs`).

## Approach

- **One record, two consumers.** Stage 1 builds the site list and the JSON; stage 2 only decides which sites are in scope and reports them. The JSON is how an author (or a reviewer) sees the same set the error is drawn from.
- **Sites mirror the emitter, not the source.** A site exists exactly when the emitter will emit a check that can fail. The oracle test (Tests) holds that: a function with no unproven site has no panic call in its IR. A site list that disagrees with the IR is a bug in one of them.
- **The scope is the program's own modules.** `std/` and dependency packages are not in scope themselves — the author cannot edit them — but a call from an in-scope function into one that may panic is a `call` site at the caller (NL2417), naming the callee and the first panic site it reaches. Without that a `noPanic` module could panic one call away and the guarantee would be hollow.
- **`--unchecked-indexing` is not a proof.** It turns a panic into undefined behaviour; under `--deny-panics` an unproven index is still an error.
- **Out-of-memory is reported, never refused.** Every allocation can fail, no source-level guard removes it, and refusing it would refuse every program that allocates. It appears in the JSON with `"allowed": true` and is documented as the one kind the guarantee excludes.

## Stages

The two stages run **in sequence**, not in parallel: both edit `src/` and every `src/` change regenerates `tests/self/goldens/checked*.txt`, so two concurrent PRs would conflict on generated files by construction. Stage 2 starts once stage 1 has merged.

### feat(checker) — record every panic site with its kind, and --emit-panics

**Owns:** `src/**`, `tests/**`, `docs/LANGUAGE.md`, `AGENTS.md`

Sections: Panic sites, The --emit-panics JSON, Tests (stage 1), Docs (stage 1).

### feat(checker) — --deny-panics and package.json noPanic refuse every remaining panic site

**Owns:** `src/**`, `tests/**`, `docs/LANGUAGE.md`, `docs/AI.md`, `docs/IR_COOKBOOK.md`, `AGENTS.md`

Depends on: `panic-sites` (development and merge). Sections: Scope, Diagnostics, Tests (stage 2), Docs (stage 2).

## Panic sites

### The kinds

| kind | emitted by | proof that removes it | guard the error suggests |
| --- | --- | --- | --- |
| `index` | `emitBoundsCheck`, `charCodeAt`, `u8[].set`, net buffers | `nodeProvenIndex` | the NL9007 wording: `if (i >= 0 && i < xs.length)` … |
| `pop` | `emitPop` on an array not proven non-empty | a dominating `xs.length > 0` | `if (xs.length > 0)` |
| `slice` | `emitSliceCheck` | `nodeProvenClamp` / its slice proof | the NL9009 wording |
| `divide` | `emitIntBinary` `/` `%` on integers | divisor proven non-zero (and not `-1`, or dividend not `MIN`, when signed) — a constant divisor counts | `if (d !== 0)` (and `d !== -1` signed) |
| `range` | `emitEntering`, `emitRangedStore`, `emitParamRangeChecks` | `nodeProvenRange` | the NL9013 wording |
| `array-length` | `emitLengthCheck` (`newArrayLengthChecked`) | length proven in `[0, 2^31)` | `if (n >= 0 && n < 2147483648)` |
| `panic` | `panic(msg)` | none — reachable unless the checker proves the path dead | — |
| `expect` | `r.expect(msg)` | none | use `orReturn` or `unwrapOr` |
| `io-exit` | `readFileSync`, `writeFileSync`, `appendFileSync`, `crypto.getRandomValues` | none | the non-exiting twin (`readFileSyncOrNull`, …) or a byte count proven ≤ 65536 |
| `parallel-length` | `parallelMapInto` (the check is `std/threads.ts`'s `panic`) | `dst.length >= src.length` proven at the call | `if (dst.length >= src.length)` |
| `call` | a call to a function whose resolved site set is non-empty | the callee is clean | names the callee and its first site |
| `oom` | any allocation | none — allowed | — |

Not sites: `process.exit(n)` (a deliberate exit), the `unreachable` after an infinite loop, `throw` (refused by Phase 0).

### Where each kind is recorded

The checker pushes a candidate `PanicSite { node, kind, fn }` where it already types the construct: [src/bounds.ts](../../src/bounds.ts) `judge` / `judgeRange` (both proven and unproven, not only in loops), [src/expressions.ts](../../src/expressions.ts) `recordRangeEntry`, [src/builtins.ts](../../src/builtins.ts) for `panic`, the io builtins and `new Array`, [src/result.ts](../../src/result.ts) for `expect`, [src/parallel.ts](../../src/parallel.ts) `recordParallelCall`. Generic bodies record per instantiation; a site in a generic is proven only if every instantiation proves it.

### Resolution

After `proveCallSiteRanges` and `checkParallel` in `Compilation.check` ([src/compilation.ts](../../src/compilation.ts):1056-1081), a pass in `src/panics.ts`:

1. drops each candidate whose proof table now says proven (re-reading `nodeProvenIndex` / `nodeProvenRange` after ranges.ts has committed);
2. computes per function the set of unproven sites, then may-panic as a fixpoint over the call graph (the same graph `attributes.ts` builds — reuse it, do not build a second), adding one `call` site per call to a may-panic callee;
3. stores the result on the compilation for the JSON (stage 1) and the scope check (stage 2).

### The --emit-panics JSON

```json
{ "functions": [
  { "name": "parse", "module": "src/parser.ts", "line": 12,
    "panics": [
      { "kind": "index", "line": 14, "column": 9, "proven": false },
      { "kind": "call", "line": 20, "column": 3, "callee": "readHeader", "via": "io-exit" },
      { "kind": "oom", "line": 15, "column": 12, "allowed": true } ] } ] }
```

Proven sites are listed with `"proven": true` so the file shows what the checker proved, not only what it did not. Path-valued like `--emit-header`; written by `writeSidecars`; `wrote <file>` on stderr. Keys and order are stable (a contract, like `--json`).

## Scope

- `--deny-panics`: every function in the program's own modules (not `std/`, not `node_modules`).
- `package.json` → `"nish": { "noPanic": ["src/parser.ts", …] }`: the `package.json` nearest above the entry file; each entry a path relative to it naming one module of the program. An entry that names no module of the program is NL3031 (a typo must not silently disable the guarantee).
- Both together: the union. Neither: no new diagnostic, and every existing golden is unchanged except the regenerated `checked*.txt`.

## Diagnostics

- **NL2416** — `` `kind` may panic here: <what fails> — <guard> `` (exact wording decided in the stage, fragment-registered). The index, range and slice guards reuse NL9007 / NL9013 / NL9009's sentence so an author sees one way of saying it.
- **NL2417** — a call into a function that may panic, naming the callee and its first site's kind and position.
- **NL3031** — a `noPanic` entry names no module of the program.
- Under deny scope the NL9007 performance warning for the same node is not printed twice.

## Tests

- **Stage 1**: `tests/cases/panics_<kind>` for every kind — `.ts`, `.ll`, `.out` where it runs, `.args` `--emit-panics`, and the expected JSON compared by `tests/run.js`. The **IR oracle**: for every `tests/cases/*.ll` golden, a function whose resolved site set (minus `oom`) is empty contains no `nish_panic_` call and no panic tail — run in `npm test`.
- **Stage 2**: `tests/cases/deny_panics_clean` — a module with guarded indexing, a proven divisor, a proven range entry and `readFileSyncOrNull`, compiled with `--deny-panics`: golden `.ll`, native round trip with `.out`, and no `nish_panic_` in its IR. One `reject_deny_panics_<kind>` (`.ts`, `.args`, `.err`) per kind except `oom`, plus `reject_deny_panics_unchecked_indexing`. `tests/link/no_panic_module` (site in a listed module refused, the same site in an unlisted one compiles), `tests/link/no_panic_transitive` (NL2417 through a call into a dependency), `tests/link/no_panic_unknown_entry` (NL3031). `tests/wordings/nl2416_*`, `nl2417_*`, `nl3031_*`.

## Docs

- `docs/LANGUAGE.md`: stage 1 adds "Panic sites" (the kinds table, what proves each away, `--emit-panics`); stage 2 adds the `--deny-panics` / `noPanic` rule and why `oom`, stack overflow and signed overflow are outside it.
- `docs/AI.md`: stage 2 adds a one-line rule and the recipe "Proving it cannot panic" (guard, prove, swap `expect` for `orReturn`, swap `readFileSync` for `readFileSyncOrNull`, read `--emit-panics`), its examples compiled by `npm test`.
- `docs/IR_COOKBOOK.md`: stage 2's entry showing the clean module's IR has no check.
- No hand edit to `CHANGELOG.md` — it is generated from the commit.

## Out of scope

- **Signed overflow.** It is `nsw` (UB), not a panic, until checked overflow lands; `--deny-panics` does not claim to cover it, and LANGUAGE.md says so. Making overflow defined is its own work.
- `src/` adopting `noPanic` for itself (the rolling freeze: not until the next release).
- Stack overflow (an OS crash with no runtime handler) — documented, not a site.
- New proofs beyond those the kinds table names; widening `bounds.ts` is separate work.

## Verification

```bash
npm run check
npm test                               # read the skip count: undegraded only
npm run lint && npm run lint:dead
node scripts/gen-diagnostic-codes.mjs --check
node tests/diagnostic-coverage.js --require-coverage   # stage 2
node docs/check-links.mjs
```
