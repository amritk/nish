---
name: A guarded nish:simd access is a proven panic site, and std/text splitLines goes lane-wise
overview: The prover records every nish:simd load and store as an unproven index site even where bounds.ts has already elided its check, so a lane-wise loop in std/ breaks every --deny-panics caller. Stage A records the site as proven whenever bounds.ts discharges the access's bound, so the panic-site table matches the IR. Stage B then moves the golden runner's lane-wise line split (tests/nish/lines.ts, #1713) into std/text splitLines.
stages:
  - id: a-prover
    title: "fix(checker): record a guarded nish:simd access as a proven panic site"
    goal: A nish:simd load or store whose bound bounds.ts discharges is recorded as a proven index site, so a --deny-panics program calling a function with a guarded loadU8x16 compiles and runs, while an unguarded one still fails with NL2458.
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js simd && node tests/run.js deny_panics && node tests/run.js caps && node tests/run.js self && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node tests/nish-cmp.js && node scripts/gen-reference.mjs --check
    todos:
      - id: a-prove-site
        content: In src/attributes.ts noteBuiltinSite (and src/panics.ts builtinPanicKind if needed), record a nish:simd access as proven exactly when bounds.ts discharged its bound (the same fact that elides its IR check, judgeVectorAccess in src/bounds.ts) — see Stage A
        status: pending
      - id: a-link-pair
        content: Add tests/link/simd_deny_panics_guarded (--deny-panics, guarded loadU8x16 in a called function, compiles and runs with expected stdout) and tests/link/simd_deny_panics_unguarded (same function, unguarded load, expected.err with NL2458) — see Stage A
        status: pending
      - id: a-regenerate
        content: Regenerate expected.caps.json files, the self goldens, docs/reference and any .ll goldens the change moves, with the repo's tooling; read each diff — see Stage A
        status: pending
      - id: a-nish-cmp
        content: Run node tests/nish-cmp.js; add narrow DECLARED entries for every corpus program whose IR moves, worded as this PR's release note — see Stage A
        status: pending
      - id: a-docs
        content: Update docs/LANGUAGE.md#panic-sites, docs/guide/language/simd.md and the CLAUDE.md nish:simd sentence to say a guarded vector access is proven and an unguarded one is not — see Stage A
        status: pending
  - id: b-split-lines
    title: "perf(runtime): split lines in std/text sixteen positions at a time"
    goal: std/text splitLines is the lane-wise split from tests/nish/lines.ts, every --deny-panics caller still builds, the golden runner uses splitLines again, and tests/nish/lines.ts is gone.
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js std_text && node tests/run.js deny_panics && node tests/run.js caps && node tests/run.js wordings && node tests/run.js self && node tests/run.js performance && npm run test:nish && node tests/nish-cmp.js && node scripts/gen-reference.mjs --check
    todos:
      - id: b-replace
        content: Replace std/text splitLines with splitLinesLanes's lane-wise body; no "proven": false in the splitLines entry of tests/link/caps_package_named_nish/expected.caps.json — see Stage B
        status: pending
      - id: b-runner
        content: Point tests/nish/run.ts back at splitLines from nish/text and delete tests/nish/lines.ts — see Stage B
        status: pending
      - id: b-twin
        content: Keep tests/link/std_text_split_lines_simd as the scalar-twin check, comparing std/text splitLines against a scalar reference copied into the test — see Stage B
        status: pending
      - id: b-positions
        content: Regenerate every pinned std/text.ts:LINE:COL from the compiler's output (grep `std/text.ts:[0-9]` — expected.caps.json, tests/wordings/*.err, docs/reference/diagnostics/), plus the self goldens and docs/reference — see Stage B
        status: pending
      - id: b-measure
        content: Add the nish-cmp DECLARED text.ll entries, and measure the runner on the simd_ filter with cachegrind (main vs main for the band, then main vs branch) for the Measured trailer — see Stage B
        status: pending
---

# A guarded nish:simd access is a proven panic site; std/text splitLines goes lane-wise

## Why

`src/attributes.ts` `noteBuiltinSite` records every `nish:simd` load and store
as an index panic site with `proven = false` (`builtinPanicKind`,
`src/panics.ts:236-240`, `isSimdAccess` → `PANIC_INDEX`), even when
`src/bounds.ts` (`judgeVectorAccess`) has already elided the access's IR check;
`tests/cases/simd_access_proven` pins only the elided check. `panicsHere`
counts the site, `firstPanic`/`keepSites` give every caller a `PANIC_CALL`
site, and `refuseSite` reports NL2458 under `--deny-panics`. That is why #1713
(1bbb57b4) kept the lane-wise split in `tests/nish/lines.ts` (`splitLinesLanes`,
−13.7% runner instructions on the `simd_` filter, band 0.01%) rather than in
`std/text.ts`: a lane-wise `splitLines` broke every `--deny-panics` caller,
including those through `std/json`, `std/yaml` and `std/cli`.

## Why stage B does not wait for a release

`std/text.ts` is compiled into the compiler (`src/watch.ts` imports `splitLines`
from `nish/text`), so the rolling freeze applies to it. It does not block stage
B, checked at 0d84269a:

- The seed, `nish 0.42.0`, compiles `tests/nish/lines.ts` (the lane-wise split)
  with exit 0. `nish:simd` is not a new builtin, so `src/` may use it.
- `scripts/bootstrap.sh` builds `src/` without `--deny-panics`. The seed's view
  of the site as unproven changes no build: it is a panic-table record. The
  fixed point compares stage2 and stage3, both built by HEAD, and HEAD carries
  stage A.
- The performance ratchet (`tests/run.js`, around line 8095) and every
  `--deny-panics` test compile with `NISH`, the HEAD-built compiler. That
  compiler has stage A's proof.

So stage B depends on stage A **merging**, not on a release. That is a chain:
B cannot be verified until A's proof is on `main`. It stays two stages because
A is worth merging alone if B stalls, and because B moves pinned `std/text.ts`
positions in three places. B is spawned once A merges. If B's worker finds a
check that does build `src/` with the seed under `--deny-panics` or with a
panic-site count, it stops and opens the PR as a draft saying which check.

## Stage A

**Owns:** `src/attributes.ts`, `src/panics.ts`, `src/bounds.ts`,
`tests/link/simd_deny_panics_*/**`, `tests/cases/simd_*`, `tests/run.js`,
`tests/shard-costs.json`, `tests/nish-cmp.js`, `docs/LANGUAGE.md`,
`docs/guide/language/simd.md`, `CLAUDE.md`, `docs/security/http1-codec.md`,
`docs/security/README.md`.

**Generated (regenerate, never hand-edit):** `tests/link/*/expected.caps.json`,
`tests/self/goldens/**`, `tests/cases/*.ll`, `tests/differential/goldens/**`,
`docs/reference/**`, `docs/cookbook/**`.

- The proof is the one that elides the IR check. A site is proven exactly when
  `bounds.ts` discharged the vector access's bound (the fact `emitVectorAccess`
  reads), so the panic table and the IR cannot disagree. Do not re-derive the
  bound in `attributes.ts`.
- The tests/link pair. The guarded program calls a function (not `main`)
  holding a `while (i + 16 <= xs.length)` loop over `loadU8x16(xs, i)`, is
  built with `--deny-panics`, runs, and pins its stdout. The unguarded program
  is the same function with the guard dropped, or an index the prover cannot
  bound. It fails with NL2458 and pins `expected.err`. Show the exact IR of
  each in the PR body.
- `std/net/http1-codec.ts` and `std/net/http1-server.ts` use `nish:simd`, so
  their `expected.caps.json` may now read `"proven": true`. If a security
  record states a count that moves, update it and its README row.
- The CLAUDE.md sentence ("A `nish:simd` load is always recorded as an unproven
  index site … lane-wise helpers for test tooling live under `tests/`") is
  rewritten to say a guarded access is proven and an unguarded one is not.
  The `tests/` clause stays until stage B.
- `src/` change rules apply: `WASI_SYSROOT=/usr node tests/run.js wasi` (read
  the skip line) and `node tests/run.js performance`. A new NL9007 blocks.

## Stage B

**Depends on:** a-prover merged. B starts after that merge.

**Owns:** `std/text.ts`, `tests/nish/run.ts`, `tests/nish/lines.ts` (deleted),
`tests/link/std_text_split_lines_simd/**`, `tests/wordings/*.err`,
`tests/nish-cmp.js`, `tests/shard-costs.json`, `CLAUDE.md`, `knip.json`.

**Generated (regenerate, never hand-edit):** `tests/link/*/expected.caps.json`,
`tests/self/goldens/**`, `tests/cases/*.ll`, `tests/differential/goldens/**`,
`docs/reference/**` (including `docs/reference/diagnostics/`).

- `splitLines` takes `splitLinesLanes`'s body and its doc comment. The
  behaviour stays identical: no trailing empty line after a final newline,
  `\r\n` keeps its `\r`, and a UTF-16 unit whose low byte is 10 is not a
  newline. The public signature and doc comment rules (`@param`, `@returns`)
  hold.
- `tests/link/std_text_split_lines_simd` compares `splitLines` against a
  scalar reference copied into the test from today's `std/text.ts`.
- Pinned positions: grep `std/text.ts:[0-9]` (today
  `tests/link/caps_package_named_nish/expected.caps.json`,
  `tests/wordings/nl2458_deny_panics_call.err`,
  `docs/reference/diagnostics/nl2xxx.md`) and regenerate each from the
  compiler's output.
- CLAUDE.md: drop the "lane-wise helpers for test tooling live under `tests/`"
  clause stage A left.
- `Measured:` gives cachegrind `Ir` for `npm run test:nish` on the `simd_`
  filter, main vs main for the band, then main vs branch.
- The full golden-runner CI job runs only on tags and `release/next`, so
  `npm run test:nish` runs locally before the PR.
