---
name: One-pass JSON field reads with bulk string skipping
overview: Stages 1–3 make std/json faster without SIMD; stage 4 records SIMD itself as a proposed work package. jsonField reads a line once per field and walks every string body one byte at a time. Stage 1 gives strings an indexOf with a start position, backed by the runtime's memchr search; stage 2 adds jsonFields, which collects several fields in one scan; stage 3 makes the std/json scanners jump over string bodies with that indexOf instead of a byte loop.
stages:
  - id: str-index-of-from
    title: compiler — s.indexOf(sub, fromIndex)
    goal: s.indexOf(sub, fromIndex) answers what JavaScript answers (fromIndex clamped into [0, s.length]), through one runtime call that uses memchr from fromIndex, with no allocation
    verification: npm run check && npm test (zero skips) && compiler fixed point reached && the new str_index_of_from golden prints the expected offsets
    todos:
      - id: idx-runtime
        content: Add nish_str_index_of_from(s, sub, from) to runtime/runtime.c and runtime/nish.h, sharing the memchr/memcmp loop with nish_str_index_of — see Stage 1
        status: pending
      - id: idx-compiler
        content: Accept the optional second argument in the checker and lower it in src/emit-strings.ts; extend src/runtime.ts and src/secret.ts where nish_str_index_of is listed; keep the NL8001 offset rules covering the new form — see Stage 1
        status: pending
      - id: idx-tests
        content: Golden tests/cases/str_index_of_from (.ts .ll .out) covering from 0, mid, past the end, negative, empty sub, sub at the end; a negative test for a non-number fromIndex; register in tests/differential/goldens/unfrozen.txt; regenerate tests/self/goldens — see Stage 1
        status: pending
      - id: idx-docs
        content: docs/LANGUAGE.md string table row, docs/cookbook entry with IR, docs/IR_COOKBOOK.md — see Stage 1
        status: pending
  - id: json-fields
    title: std/json — jsonFields, several fields in one scan
    goal: jsonFields(object, names) answers, for every name, exactly what jsonField(object, name) answers, after one scan of object
    verification: npm run check && npm test (zero skips) && tests/link/std_json passes with jsonFields checked against jsonField on every existing case
    todos:
      - id: fields-api
        content: Add exported jsonFields(object, names: string[]) returning (string | null)[] in std/json.ts, one scan, first occurrence of a duplicate key wins as in jsonField; refactor so jsonField and jsonFields share the per-key step — see Stage 2
        status: pending
      - id: fields-tests
        content: Extend tests/link/std_json — for every existing jsonField case assert jsonFields agrees; plus empty names, a repeated name, names absent, malformed objects, keys in any order — see Stage 2
        status: pending
      - id: fields-docs
        content: Document jsonFields in std/json.ts's header and docs/wp26-stdlib.md, cookbook entry docs/cookbook/json-fields.ts — see Stage 2
        status: pending
  - id: json-skip-strings
    title: std/json — skip string bodies with indexOf
    goal: Every std/json scan over a string literal (jsonEndOfString and the in-string branch of jsonEndOfValue) jumps to the next quote with s.indexOf(quote, from) and counts the backslashes before it, with answers byte-identical to before
    verification: npm run check && npm test (zero skips) && tests/link/std_json passes with new long-string, escaped-quote and backslash-run cases
    todos:
      - id: skip-impl
        content: Rewrite jsonEndOfString and the in-string branch of jsonEndOfValue (and any other string walk) on indexOf(quote, from) plus an odd/even backslash count; keep the bounds proof (no NL9011/perf warning raised) — see Stage 3
        status: pending
      - id: skip-tests
        content: Link tests for a quote preceded by 1, 2, 3 and 4 backslashes, a string ending at the end of input, an unterminated string, braces and brackets inside long strings, non-ASCII bytes — see Stage 3
        status: pending
      - id: skip-measure
        content: Measure per the Measurement section and put figures in the commit's Measured trailer — see Measurement
        status: pending
  - id: simd-design
    title: design — WP38, SIMD
    goal: The repo's design plans carry SIMD as a proposed work package with a note that states the options, a recommendation, the TypeScript reading, the target policy and the measurements that would justify each stage
    verification: npm run check && npm test (zero skips) && node docs/check-links.mjs passes && MASTER_PLAN.md and docs/README.md list WP38 with a link to docs/wp38-simd.md
    todos:
      - id: simd-note
        content: Write docs/wp38-simd.md as a proposal — see Stage 4
        status: pending
      - id: simd-index
        content: Add WP38 to docs/MASTER_PLAN.md §5 (proposed) and §9 What remains, an Open decisions row in §3.4, and an entry in docs/README.md — see Stage 4
        status: pending
  - id: escape-returned-array
    title: escape analysis — a value stored into a returned fresh array flows as returned
    goal: A function that allocates an array, fills it with values it built, and returns it keeps its callers' per-pass arena release; the stored values are treated as returned with the array, not as escaping into memory
    verification: npm run check && npm test (zero skips) && compiler fixed point reached && the new golden prints the same Arena.used() before and after 1000 calls
    todos:
      - id: esc-rule
        content: In src/escape.ts, a value stored into an array (element store or push) that this function allocated (literal or new) and whose only flow is FLOW_RETURNED (or FLOW_LOCAL) takes the array's flow instead of escaping; any other use of the array (stored, captured, passed to a callee that stores, read back and stored elsewhere) keeps today's behaviour — see Stage 5
        status: pending
      - id: esc-tests
        content: Positive golden tests/cases/mem_return_array_scope (.ts .ll .out) with an Arena.used() round trip over 1000 calls; negative goldens where the array is stored to a field, captured, or an element is read back and stored, keeping the release off; register in tests/differential/goldens/unfrozen.txt; regenerate tests/self/goldens — see Stage 5
        status: pending
      - id: esc-docs
        content: docs/LANGUAGE.md Memory model rule, docs/cookbook/mem-return-array.ts and its IR_COOKBOOK.md block; measure jsonFields on PR #509's branch with the rule (Measured trailer) — see Stage 5
        status: pending
  - id: security-record
    title: docs(security) — record #520's readdirSync fixes in CG-5
    goal: docs/security/codegen.md records the four readdirSync listing use-after-frees #520 closes, the string-only boundary of the carried-element rule, and the conservative cg_sec_readdir_pass precision loss, each citing its golden
    verification: npm run check && node docs/check-links.mjs && npm run lint
    todos:
      - id: sec-cg5
        content: Update docs/security/codegen.md's CG-5 row (or add a row) per issue #522 — see Stage 6
        status: pending
---

## Context

`jsonField(object, name)` starts from the beginning of `object` on every call, so a caller that wants three fields scans each line three times. Inside each scan, string bodies — most of the bytes in a real line — are walked one `charCodeAt` at a time (`jsonEndOfString`, the `inString` branch of `jsonEndOfValue`). In the recorded cross-language report Nish was 122.7 ms on `bench/json` (gjson 118.3, typed serde 82.4, simdjson 36.8); after #499/#500 it is about 90–94 ms.

The runtime already has a vectorised search: `s.indexOf(sub)` is one `nish_str_index_of` call that uses libc `memchr`. But `indexOf` takes no start position, and `substring` allocates and copies, so `std/json` cannot use it mid-string today. Stage 1 adds the start position.

## Stage 6 — security record for #520 (added 2026-10-09T20:35Z at the owner's request: "do the rest of the PRs"; tracks #522)

- Record in `docs/security/codegen.md` (CG-5 row, or a new row beside it): the four `readdirSync` listing escapes #520 closed (wrapper return, passed to a function, assigned to a returned local, stored into a field), pinned by `tests/cases/mem_return_array_readdir`; the string-only carried-element boundary pinned by `mem_return_array_nested`, and why arrays/objects are excluded; the conservative loss in `cg_sec_readdir_pass` (`@test` no longer releases at exit). Read #520's merged diff and #522 first; state only what the code and goldens show.
- Owns: `docs/security/codegen.md`, `docs/security/README.md` (only if its index lists CG rows).
- Commit: `docs(security): record the readdirSync listing fixes from #520 in CG-5`, closing #522.
- Runs concurrently with stage 3; disjoint files.

## Stage 5 — escape analysis: a returned fresh array carries its elements (added 2026-10-09T07:11Z, owner-approved)

- Why: #509's `jsonFields` returns an array it filled with fresh value strings; `src/escape.ts` notes each element store as a store into memory, so every calling loop loses its per-pass release (≈46 B/call, 105.5 vs 88.1 MB peak RSS on bench/json input). The precedent is #500's `pushedIntoJoinedParts`: a narrow, allow-listed rule.
- Rule: a value stored (`xs[i] = v`, `xs.push(v)`) into an array `xs` that this function allocated (array literal or `new Array`) takes `xs`'s own flow when every use of `xs` is an element store, a push, `.length`, or the return of `xs` itself. Any other use — `xs` stored to a field/global/another array, captured, passed to a callee, an element read back — keeps today's behaviour. That is the soundness argument: the elements cannot outlive the array except through the array.
- Develops in parallel with #513, merges after it (both touch `src/` and `tests/self/goldens`): merge `main` and regenerate goldens before merge.
- Owns: `src/escape.ts`, `src/attributes.ts` (only if a helper is needed), the `src/` files whose NL9011 count would rise (fix, never raise), `tests/perf-baseline.json` (lower only), `tests/cases/mem_return_array_*`, `tests/differential/goldens/unfrozen.txt`, `tests/self/goldens/**`, regenerated `.ll`/`.out` the rule moves, `docs/LANGUAGE.md` (Memory model section), `docs/cookbook/mem-return-array*`, one `mem-return-array` block in `docs/IR_COOKBOOK.md`, and `tests/nish-cmp.js` `DECLARED` entries for the IR the rule moves (`.claude/selfhost.md` requires them).
- Commit: `perf(codegen): a value stored into a returned fresh array is returned with it`, `Measured:` jsonFields loop kept bytes and peak RSS before/after, `Tests:` the goldens.

## Stage 1 — `s.indexOf(sub, fromIndex)`

- JavaScript's semantics: `fromIndex` is clamped into `[0, s.length]`; the answer is the first byte offset `>= fromIndex` where `sub` occurs, or `-1`; an empty `sub` answers the clamped `fromIndex`.
- One runtime call, no allocation. Prefer extending the existing loop over a second copy of it.
- Follow `.claude/selfhost.md` "Adding a builtin" for every file a builtin touches. The rolling freeze: `src/` may not use the new form in its own source; `std/` may.
- Owns: `runtime/runtime.c`, `runtime/nish.h`, `src/**` (only the files the builtin checklist names, plus any whose NL9011 count would rise — fix, never raise), `tests/cases/str_index_of_from*`, `tests/cases/reject_str_index_of_*`, `tests/differential/goldens/unfrozen.txt`, `tests/self/goldens/**`, `docs/LANGUAGE.md`, `docs/cookbook/str-index-of-from*`, `docs/IR_COOKBOOK.md`, `tests/nish-cmp.js` (`DECLARED` entries, required by `.claude/selfhost.md` "Adding a builtin").
- Commit: `feat(runtime): accept a start position in s.indexOf` (or `feat(checker)`), `Tests:` the goldens.

## Stage 2 — `jsonFields`

- `jsonFields(object: string, names: string[]): (string | null)[]` — one entry per name, in the order of `names`, each exactly `jsonField(object, name)`. One left-to-right scan of `object`; it may stop as soon as every name is found.
- Duplicate keys: the first occurrence wins, as in `jsonField`. Malformed input: every slot answers what `jsonField` answers for it.
- The result array is the only new allocation besides the values; check that a loop calling it keeps its per-pass release (no NL9011 raised, an `Arena.used()` check in the link test or a golden).
- Owns: `std/json.ts`, `tests/link/std_json/**`, `docs/wp26-stdlib.md`, `docs/cookbook/json-fields*`.
- Commit: `feat(std): read several JSON fields in one scan with jsonFields`.

## Stage 3 — skip string bodies

- From the byte after an opening quote, `q = text.indexOf("\"", i)`; count the run of backslashes immediately before `q`; odd means the quote is escaped, continue from `q + 1`; even means the string ends at `q`. Unterminated → `-1` as today.
- Applies to every string walk in `std/json.ts` that only needs the end of the string. `jsonUnescape` and the key compare still walk bytes, because they decode.
- Starts after stages 1 and 2 merge (needs stage 1's `indexOf`; owns the same file as stage 2).
- Owns: `std/json.ts`, `tests/link/std_json/**`.
- Commit: `perf(std): skip JSON string bodies with a memchr search`, `Measured:` per below.

## Stage 4 — WP38, SIMD (design only, no code)

A proposal note in the shape of the other `docs/wpN-*.md` plans, written from the evidence in the repo, not from memory:

- **What exists:** no vector types or intrinsics; LLVM auto-vectorises counted loops at `--profile speed` (pinned by the WP1/WP4/WP9 tests); libc `memchr`/`memcmp` behind `indexOf`; no `-march`. Byte scanners with early exits (`std/json`, lexers, `src/` itself) get nothing.
- **Options, each with cost, what it buys and what it withdraws:** (a) runtime C kernels with run-time CPU dispatch (memchr-style primitives: find any of a byte set, classify a block); (b) a `nish:simd` module of fixed-width vector types (`u8x16`, `i32x4`, `f32x4`, `f64x2`…) lowering to LLVM vectors, portable ops only; (c) explicit target intrinsics; (d) leaning harder on auto-vectorisation (loop shapes, `-march` policy). A recommendation with an order of stages.
- **Constraints the note must answer:** WP33's rule — the construct's TypeScript reading and how it runs under Node; wasm (`simd128`) and N-API targets; the default target and `-march` policy (simdjson dispatches at run time); `Secret` and constant-time code in `std/crypto`; the rolling freeze for `src/`; the checker rules and negative tests a new type family needs.
- **Measured motivation and the bar:** `bench/json` (Nish ~90 ms after this run's stages 1–3 vs simdjson 37 ms), plus at least one numeric kernel from `bench/` (nbody, spectral, vec3) and a byte scan; what each stage must show before it ships.
- MASTER_PLAN.md: WP38 row "proposed", a §3.4 Open decisions row (SIMD surface: runtime kernels / `nish:simd` types / intrinsics), a "Next" or "Additive and unscheduled" entry in What remains. docs/README.md: one index line.
- Owns: `docs/wp38-simd.md`, `docs/MASTER_PLAN.md`, `docs/README.md`.
- Commit: `docs: propose WP38, SIMD`.
- Runs concurrently with stages 1 and 2; no merge-order edge.

## Real-world evidence, not just the benchmark

- No tuning to `bench/json`'s generator: every change must help any JSON with strings, not this input's shape.
- Each perf PR reports, before and after on the same machine: `bench/json` (harness from branch `ccr-ee7596b7-up0cqq` @ 956506d, checked out, never committed); a compiler `--json` diagnostic line; a 50-key object with the wanted field last; a miss; a line with short strings only (the case where a call per string could lose).
- `node bench/run.mjs --instructions --check` passes with `bench/instructions.json` unchanged, and `tests/perf-baseline.json` is never raised.
- Noise is reported honestly: medians of at least 7 runs, and a loss on any shape is stated, not hidden.

## Measurement

Time a loop whose input changes on every iteration and whose output is folded into a printed checksum. Report min and median ms and peak RSS. Stage 3's `Measured:` trailer states the figures for `jsonField` ×3 and `jsonFields` on `bench/json`.

## Out of scope

- Building any SIMD: vector types, intrinsics, a C JSON scanner in the runtime, `-march` flags. Stage 4 only designs it.
- Changing `jsonField`'s answers in any case.
- `jsonUnescape`'s value decoding.

## Verification

```
npm run check
npm test            # read the skip count: undegraded means zero skips
node tests/self/goldens.js --update   # stage 1 only, then read the diff
```

## Acceptance criteria

1. `s.indexOf(sub, fromIndex)` answers what Node answers for from 0, mid-string, past the end, negative, an empty `sub` and a match at the very end, and its IR is one runtime call with no allocation.
2. `jsonFields(line, ["code", "line", "message"])` answers, slot for slot, exactly what three `jsonField` calls answer — on every existing `std_json` case, on malformed objects and on duplicate keys.
3. After stage 3, `jsonField` answers byte-identically to before on quotes preceded by 1–4 backslashes, unterminated strings, braces and brackets inside strings, and non-ASCII text.
4. A loop calling `jsonFields` 1,000 times keeps its per-pass arena release (no NL9011 raised, `Arena.used()` flat).
5. On `bench/json`, `jsonFields` on merged `main` beats gjson's recorded 118 ms by a clear margin and is at or below typed serde's 82 ms on the same machine, and `jsonField` ×3 is no slower than before stage 3. Figures are in the `Measured:` trailers.
6. On the non-benchmark shapes — a compiler `--json` line, a 50-key object with the field last, a miss, and a line of short strings only — neither `jsonField` nor `jsonFields` is slower than on base.
7. `node bench/run.mjs --instructions --check` passes with `bench/instructions.json` unchanged, `tests/perf-baseline.json` is not raised, and the compiler reaches its fixed point.
8. `docs/wp38-simd.md` exists and states the current state, at least three options with their costs, a recommendation with ordered stages, the TypeScript and wasm reading, the `-march` policy, and the measured bar each stage must clear. `docs/MASTER_PLAN.md` lists WP38 as proposed, and `docs/README.md` links it.
