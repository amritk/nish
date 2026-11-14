---
name: Narrow the JSON tokenizer gap to yyjson
overview: Cut the instructions nish/json-tokenizer spends per document on numbers, per-token grammar and string runs, measured by callgrind and bench/json-compare against a byte-identical-copy band, and keep only cuts that also speed up held-out float-heavy and string-heavy payloads.
stages:
  - id: numbers
    title: perf(runtime) — parse a JSON number in one pass
    goal: numberF64 and the number scan in value stop reading each digit twice and stop paying per-digit bookkeeping, so canada.json and citm_catalog.json tokenize in fewer instructions with bit-for-bit the same doubles
    verification: npm run check && npm run lint && node tests/run.js json && node tests/run.js nish-cmp && node scripts/gen-reference.mjs --check
    todos:
      - id: numbers-baseline
        content: Re-measure Ir per document at the base for the three corpora, typed, typed-reuse and the held-out payloads — see Measuring
      - id: numbers-one-pass
        content: Fuse the scan in JsonTokenizer.number with the accumulate in numberF64 so the digit run is read once — see Stage numbers
      - id: numbers-int-path
        content: Add the integral fast path (at most 15 digits, no per-digit test, exact convert) and the direct sign read, S6d cuts A and N3 — see Stage numbers
      - id: numbers-swar
        content: Accumulate eight digits at a time where the run allows it, and drop the per-digit counters the long path does not need — see Stage numbers
      - id: numbers-tests
        content: Pin every new path boundary in tests/link/std_json_tokenizer and keep S6b's bit-for-bit check passing — see Tests
      - id: numbers-measure
        content: Measure, keep only cuts that pay on the held-out payloads, write the Measured trailer and nish-cmp DECLARED entries — see Measuring
  - id: kernel-utf8
    title: perf(runtime) — cheaper string runs past non-ASCII bytes
    goal: The plain-string run kernel in runtime/runtime-bytes.c stops costing about 142 instructions a call on twitter.json, by finding where that cost goes and cutting it, with the scalar, SSE2 and AVX2 paths still agreeing on every input
    verification: node tests/run.js simd && node tests/run.js c-symbols && node tests/run.js runtime && node tests/run.js json && node scripts/security-scope.mjs
    todos:
      - id: kernel-attribute
        content: Attribute nish_run_avx2's cost per call on twitter.json to setup, the ASCII vector loop and the UTF-8 resume path — see Stage kernel-utf8
      - id: kernel-cut
        content: Cut the dominant part (a vector UTF-8 check for multi-byte runs, or cheaper entry), keeping every path's answer identical — see Stage kernel-utf8
      - id: kernel-tests
        content: Extend tests/simd/byte-runs.c so every UTF-8 sequence class lands at every offset of a block on every path — see Tests
      - id: kernel-record
        content: Update docs/security/bytes.md, the unit's size in docs/wp7-runtime.md and tests/runtime-budgets.js, and write the Measured trailer — see Stage kernel-utf8
  - id: grammar
    title: perf(runtime) — less fixed work per JSON token
    goal: next, value, key, top, close and stringInto do S6d's per-token cuts and drop the redundant bounds re-tests, so every document pays fewer instructions per token
    verification: npm run check && npm run lint && node tests/run.js json && node tests/run.js nish-cmp && node scripts/gen-reference.mjs --check
    todos:
      - id: grammar-container-field
        content: Keep the innermost container's kind in a field set by open and close (S6d cut G) — see Stage grammar
      - id: grammar-failed-state
        content: Make fail set a sixth state so next drops its sticky-error test (S6d cut H2) — see Stage grammar
      - id: grammar-fused-dispatch
        content: Switch on the byte first in next (S6d cut D) and give string one limit comparison (S6d cut E2) — see Stage grammar
      - id: grammar-bounds
        content: Remove jsonTokByteAt re-tests and src.length re-reads that a dominating test already proves — see Stage grammar
      - id: grammar-string-copy
        content: Copy the plain runs of an escaped string whole in stringInto (S6d cuts C2 and C), only if it pays on the held-out API payload — see Stage grammar
      - id: grammar-measure
        content: Measure each cut, keep only those that pay, write the Measured trailer and nish-cmp DECLARED entries — see Measuring
  - id: record
    title: docs(runtime) — record the JSON tokenizer result
    goal: docs/BENCHMARKS.md carries a fresh json-compare record taken after the three stages merged, and the held-out payload table shows what real programs gained
    verification: node bench/json-compare/run.mjs --rounds 9 --mb 128 --record && node bench/json-compare/heldout.mjs --check && npm run lint
    todos:
      - id: record-heldout
        content: Commit bench/json-compare/heldout.mjs, the held-out generator and its Ir comparison — see Stage record
      - id: record-run
        content: Run bench/json-compare/run.mjs --record against the merged main and write the held-out table beside it — see Stage record
      - id: record-wp38
        content: Add a short note on what this run cut to docs/wp38-simd.md beside S6d — see Stage record
---

# Narrow the JSON tokenizer gap to yyjson

## Context

[docs/BENCHMARKS.md](../../docs/BENCHMARKS.md) ("JSON against other languages") has Nish's tokenize workload behind yyjson by 2.02x on twitter.json, 1.60x on citm_catalog.json and 2.18x on canada.json, and behind serde_json by 1.10x on canada. The vector work in [docs/wp38-simd.md](../../docs/wp38-simd.md) has already landed or been ruled out. S6a put blanks, digits and plain string bytes on run kernels. S6b put Eisel–Lemire in `numberF64`. S6c's structural index failed its callgrind gate. S6d priced eight per-value cuts by prototype and built none of them, because together they could not lift S6c to 1.5x. On their own they are real savings.

A profile taken at `d38a94b0` for this plan (callgrind, `--profile speed`, `-g` build used only for attribution) gives:

| Document | Nish Ir/doc | yyjson Ir/doc | Ir ratio | Wall ratio (record) |
| --- | ---: | ---: | ---: | ---: |
| twitter.json | 12.33M | 4.80M | 2.57x | 2.02x |
| citm_catalog.json | 25.69M | 12.47M | 2.06x | 1.60x |
| canada.json | 120.0M | 50.62M | 2.37x | 2.18x |
| typed, citm | 29.70M | — | | |
| typed-reuse, citm | 29.41M | — | | |

Hot frames, as exclusive Ir:

- **canada**
  - `numberF64` is 54.2%, about 320 Ir per number and about 540 Ir per number in all. yyjson spends about 227.
  - Its digit loop reads every digit a second time after `number()` has already scanned it, which is about 14% of canada. Per-digit bookkeeping (counters, the `FAST_DIGITS` tests, `scale`) is about 20%. Bounds re-tests are 4.6%. Eisel–Lemire itself is 0.8% and the slow path never runs.
  - `value` is 25%.
- **twitter**
  - `nish_run_avx2` is 21.6%, about 142 Ir a call. The UTF-8 resume lines (`nish_run_wide` / `nish_run_resume`) are hot.
  - `next` is 17.9%.
  - `string` + `stringInto` + `memcpy` + the copy wrapper are about 31%.
  - The `jsonTokByteAt` bounds test is 6%.
- **citm**
  - `next` is 25%, `numberF64` 16% (all integers) and `value` 13%.
  - The kernel is 9.9% and `jsonTokSkipBlank` 2.8%.
- **typed and typed-reuse**
  - `keyEquals` and `isInteger` are about 24%, and `numberI64` is 10%.
  - They share `next`, `value` and `string` with tokenize, so the grammar and number stages reach them as well.

## Approach

- **Profile-led, three independent levers.**
  - Numbers, for float-heavy documents (canada, GeoJSON, metrics).
  - The string-run kernel, for string-heavy documents with non-ASCII text (twitter, API responses).
  - Per-token grammar work, for every document, and most for structure-heavy ones (citm).
- **No new structural index or classifier.** S6c ruled that out. These stages are scalar or small-kernel changes to existing code.
- **Kept only if real programs gain.** A cut lands only if it lowers Ir on the held-out payload of its class (see Measuring) and does not raise Ir outside noise on any of the others. A cut that wins on one corpus file and loses on a held-out payload is dropped, and the PR says so with its numbers.
- **Correctness bars are S6a's and S6b's, unchanged.**
  - `numberF64` stays bit-for-bit `parseFloat`.
  - Every JSONTestSuite verdict, error code and `errorAt` offset stays the same.
  - The scalar, SSE2 and AVX2 kernel paths agree.
- **Stage order.** `numbers` and `grammar` both edit [std/json-tokenizer.ts](../../std/json-tokenizer.ts), so `grammar` starts after `numbers` merges. `kernel-utf8` only touches the runtime, so it runs alongside `numbers`. `record` runs last.

## Measuring

Every stage measures the same way and reports in its PR body and its `Measured:` trailer ([.claude/testing.md](../testing.md) → "A `Measured:` trailer").

1. **Instructions.** Use callgrind on `bench/json-compare/main.ts`, built `--link --profile speed` as `run.mjs` builds it. Ir per document is (N=10 − N=1) / 9, for:
   - tokenize on all three corpora;
   - typed and typed-reuse on citm;
   - the held-out payloads below.

   Checksums must equal the base's. Build a `-g` binary only to attribute where a saving fell.
2. **Wall clock.** Run `node bench/json-compare/run.mjs --only nish` on the branch and on the base, interleaved, with the base's byte-identical copy giving the noise band. Claim "faster" only outside the band. The typed and typed-reuse rows must not be slower outside their band.
3. **Held-out payloads.** These are generated, never tuned on, and kept outside the checkout until `record` commits the generator:
   - **metrics**: about 1 MB of objects such as `{"ts":1731571200123,"host":"web-07","cpu":0.4375,"lat_ms":[12.5,8.25,103.125],"ok":true}`. The floats carry 1 to 6 decimals, from a seeded LCG.
   - **api**: about 1 MB, an array of GitHub-API-shaped user and issue objects. Each has 20 to 40 keys, URLs, ISO dates, null fields, and a `body` string of 50 to 800 bytes. A third of the bodies carry non-ASCII text (CJK, accented Latin, emoji) and some carry `\n` and `\"` escapes. Use a seeded LCG.
   - **small**: `bench/json-tokenizer`'s 242-byte body. A fixed per-call cost must not move on it.

   Run each through the tokenize workload: `main.ts`'s `tokenize` accepts any file.
4. **nish-cmp.** A change to `std/` or `runtime/` that moves a corpus program's IR adds narrow `DECLARED` entries to [tests/nish-cmp.js](../../tests/nish-cmp.js) in the same PR (CLAUDE.md).

## Stage numbers

Owns: `std/json-tokenizer.ts`, `tests/link/std_json_tokenizer/**`, `tests/link/std_json_number/**`, `tests/fuzz/corpus/json-tokenizer/**`, `tests/nish-cmp.js`, and the generated `tests/self/goldens/checked/**` and `docs/reference/**`.

- **One pass.** `number(at)` already walks the token to find its end and check its grammar. `numberF64` (around line 1377) walks it again, bounds-testing each byte and re-reading `src.length`; the comment there says the hoist is lost to the `numberSlow` call. Give the digit walk one home:
  - either `number` accumulates the mantissa, digit count and exponent into fields as it scans and `numberF64` converts from them;
  - or `numberF64` takes the end `number` found and walks without per-byte bounds tests.

  Choose by measurement. Tokenizing without reading the number (`skipValue`, a key's value never read) must not get slower: check `typed`, which skips nothing, and the api payload, which is mostly strings.
- **Integral fast path (S6d cut A).** An integral token of at most 15 digits accumulates with no per-digit test and converts exactly, because 10^15 < 2^53. S6d measured 2,538,377 Ir an iteration saved on citm. **N3:** read the sign byte directly after one bounds test.
- **Eight digits at a time.** Where at least eight bytes remain before the token's end, test and fold eight ASCII digits in a u64 at once (the SWAR digit trick, as in fast_float's `parse_eight_digits_unrolled`; [std/LICENSE-fast-float](../../std/LICENSE-fast-float) already covers the port). Drop the per-digit counters that only the slow path needs, and recompute them on the rare fallback instead.
- **Unchanged:** the Eisel–Lemire table and its fallback to `parseFloat` above 19 significant digits, `numberI64`'s range answers, and every `JSON_TOK_ERR_NUMBER` / `_NUMBER_LIMIT` code and offset.

## Stage kernel-utf8

Owns: `runtime/runtime-bytes.c`, `tests/simd/**`, `docs/security/bytes.md`, `docs/wp7-runtime.md`, `tests/runtime-budgets.js`, `src/c-symbols.ts` (only if a new libc symbol is unavoidable).

- **Attribute first.** Twitter's plain-string runs cost about 142 Ir per kernel call. Split that with a `-g` callgrind run into:
  - resolver and entry;
  - the 32-byte ASCII loop;
  - the UTF-8 resume path (`nish_run_wide`, `nish_run_resume`), which validates multi-byte sequences one by one.

  Count twitter's strings that contain a byte ≥ 0x80 and the share of bytes that are non-ASCII.
- **Cut the dominant part.** The likely cut is a vector check of a block of multi-byte UTF-8, a lookup-table validator in the style of Keiser–Lemire, rejecting overlongs, surrogates and anything above U+10FFFF exactly as the scalar step does. It runs on the SSE2 and AVX2 paths, and the scalar step stays the reference. If attribution shows the cost is entry rather than UTF-8, cut the entry instead and say why.
- **Same answers.** Every path returns the same index for every input. Invalid UTF-8 still stops at the same byte, so the tokenizer's `JSON_TOK_ERR_UTF8` offset is unchanged.
- **Size.** `runtime-bytes.c` is at 1,525 of its 1,536-byte ceiling (`RUNTIME_BYTES_TEXT_BUDGET`). If the cut needs more, raise the ceiling in `tests/runtime-budgets.js` and the row in [docs/wp7-runtime.md](../../docs/wp7-runtime.md) by the measured size, with the Ir gain beside it, and put the change at the top of the PR body. It is a recorded trade-off, never a silent bump.
- **Security record.** This code reads attacker bytes. Add the change and its before/after tests to [docs/security/bytes.md](../../docs/security/bytes.md).
- **Wasm and other targets.** Nothing changes there: they use the scalar Nish loop.

## Stage grammar

Starts after `numbers` merges. Owns the same files as `numbers`.

These are S6d's measured cuts, built for real. Each is measured on top of the last, and dropped if it does not pay:

| Cut | Change | S6d's saving, twitter / citm (Ir an iteration) |
| --- | --- | ---: |
| G | innermost container kind in a field set by `open` and `close`; the comma path and `close` read no stack | 187,271 / 308,644 |
| H2 | `fail` sets a sixth state, so `next` drops its sticky-error test | 165,321 / 409,329 |
| D | `next` switches on the byte first and tests what it wants inside each case | 261,558 / 549,212 |
| E2 | a `stringFrom` field makes `string`'s length limit one comparison | 144,788 / 202,045 |
| C2, C | `stringInto` copies an escaped string's plain runs whole; a no-escape string is one range test and one `copyBytes` | 239,856 / −52,852 |
| bounds | `jsonTokByteAt` re-tests and `src.length` re-reads already proven by a dominating test (4.6% to 6% of Ir on each document) | — |

C2 lost on citm in S6d, so it lands only if the api payload gains and citm stays inside its band. Error codes and `errorAt` offsets are unchanged on every JSONTestSuite `n_` file and the conformance corpus. A cut that helps `keyEquals` or `isInteger` in typed decode for free is welcome, but this stage does not redesign them.

## Stage record

Owns: `docs/BENCHMARKS.md`, `docs/wp38-simd.md`, `bench/json-compare/heldout.mjs`, `bench/json-compare/README.md` (if present).

- Commit `bench/json-compare/heldout.mjs`. It generates metrics and api from fixed seeds as specified in Measuring, builds main.ts, and prints Ir per document by callgrind for a given compiler, with `--check` holding the generated bytes to a pinned hash.
- Run `node bench/json-compare/run.mjs --rounds 9 --mb 128 --record` on main after the three stages merge. If cargo or Go cannot be installed in the container, record what runs and name the missing rows. Never paste old rows in.
- Under the json-compare markers' section, add a short "held-out payloads" table: base `f8e21091` vs merged main, Ir per document, metrics / api / small.
- In docs/wp38-simd.md, beside S6d, add one paragraph naming which of its cuts were built and by which PRs.

## Out of scope

- No structural index, block classifier or `nish:simd` surface (S6c is closed).
- No change to `std/json-typed.ts`, `std/json-value.ts` or the writer. Typed decode must not regress, but it is not tuned here.
- No change to `src/`. If a cut needs a compiler change, the stage stops and says so in its PR.

## Tests

- [tests/link/std_json_tokenizer/](../../tests/link/std_json_tokenizer/) `units.ts` and `corpus.ts` pin every new boundary:
  - 15 and 16 digits;
  - exactly 8 and 9 digits after a sign or dot;
  - a digit run ending at the buffer's last byte;
  - a number split by a window (`JSON_TOK_ERR_WINDOW`).
- S6b's bit-for-bit check (canada's numbers, JSONTestSuite, random doubles natively and under Node) keeps passing. Find it with `grep -rn "parseFloat" tests/run.js tests/link/std_json_tokenizer`.
- [tests/simd/byte-runs.c](../../tests/simd/byte-runs.c) puts every UTF-8 class at every offset of a block, valid and invalid (overlong, surrogate, > U+10FFFF, truncated), and checks that the paths agree.
- Each test added by a PR shows its exact LLVM IR in the PR body where it is a TypeScript snippet (CLAUDE.md).

## Verification

Per stage, as each stage's `verification` line says, plus CI's eight `test` shards, `bootstrap`, `nish-cmp` and `lint` green on the PR head.
