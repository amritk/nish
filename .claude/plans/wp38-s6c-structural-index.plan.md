---
name: WP38 S6c — the structural index for JsonTokenizer
overview: The owner accepts the design in docs/wp38-simd.md §7 ("S6c, the structural index: the design") on 2026-10-24 (§8, Q5). Two stages, in order. The gate measures, with callgrind on main, whether removing the per-byte dispatch and per-string kernel call can buy the S6c row's 1.5x on twitter.json and citm_catalog.json, and records the decision and the figures; if the ceiling is below the bar the run stops there with nothing built. Only on a reachable verdict does the build stage add the kernel (one bitmap word per 64-byte block, built in 4 KiB chunks into a fixed buffer kept across documents, in-string mask by prefix XOR), the private Nish walker that is its meaning, and the tokenizer walking set bits, with every error still the scalar code's — then rebenches against simdjson on bench/json-compare and records the result.
stages:
  - id: gate
    title: "docs(wp38): S6c's callgrind gate, and the owner's Q5 decision"
    goal: docs/wp38-simd.md records the owner's acceptance of the S6c design in §8's Q5 row dated 2026-10-24, and a callgrind measurement on main's head of tokenize on twitter.json and citm_catalog.json that splits the instructions into what the structural index removes and what it keeps, with an instruction-count ceiling per file and a stated verdict — REACHABLE if both ceilings clear 1.5x after the kernel's own measured cost, NOT REACHABLE otherwise
    verification: npm run lint (exit status, not a piped tail); the callgrind commands recorded in docs/wp38-simd.md reproduce the recorded instruction totals within 1% when rerun on the PR head
    status: pending
    todos:
      - id: q5-decision
        content: "Record the owner's decision in §8's Q5 row: the design in §7 is accepted as recommended on 2026-10-24 (one bitmap per 64-byte block, 4 KiB chunks into a fixed buffer kept across documents, the kernel gives hints and every error stays the scalar code's), built only if this stage's callgrind gate is REACHABLE. Update the S6c row in §7's table from 'awaiting the owner' to 'accepted, gate measured' — see The decision"
        status: pending
      - id: callgrind-split
        content: "Run callgrind on bench/json-compare's tokenize loop (or a harness that runs exactly that loop) for twitter.json and citm_catalog.json on main's head, built --profile speed as the benchmark builds it, and attribute every instruction to one of: (a) removable — the per-byte steps between tokens, the dispatch on a token's first byte that the index answers, the per-string kernel call and its setup for strings with no escape; (b) kept — number parsing, stringInto's copy, the depth stack, limits, the fold, the loop harness — see The split"
        status: pending
      - id: kernel-cost
        content: "Measure the kernel's own cost, not assume it: a throwaway C prototype of the block classifier (quotes, backslashes, structural, blanks, odd-backslash carry, prefix XOR, the UTF-8 check) under callgrind on both files, in instructions per input byte, on the SSE2/AVX2 path the bench host runs. It is not committed — only its source location in the PR body and its figures in the doc — see The split"
        status: pending
      - id: verdict
        content: "Compute per file: ceiling = total / (kept + walker's per-token cost + kernel cost), state the assumptions, and write the verdict REACHABLE or NOT REACHABLE against 1.5x on both files into the S6c design section of docs/wp38-simd.md. If NOT REACHABLE, also say what the ceiling is and what part of the kept work would have to move for the bar to be reachable. Do not tune the analysis toward the bar — see The verdict"
        status: pending
  - id: build
    title: "perf(runtime): JsonTokenizer walks a structural index"
    goal: JsonTokenizer finds tokens by walking a per-64-byte-block bitmap built in 4 KiB chunks by runtime/runtime-json-index.c into a fixed buffer kept across reset, with a private Nish walker as its meaning; tokenize on twitter.json and citm_catalog.json is at least 1.5x faster at the minimum than the 96899c11 record, typed decode of citm is faster outside its band, nothing else is slower outside its band, and every error code and errorAt offset is unchanged on every JSONTestSuite n_ file and the conformance corpus — with the result recorded against simdjson in docs/BENCHMARKS.md and docs/wp38-simd.md
    verification: npm run check; npm run lint; node tests/run.js json; node tests/run.js simd; node tests/run.js bytes; node tests/run.js aes; node tests/run.js wasi (WASI_SYSROOT=/usr, skip line read); node tests/run.js performance; node tests/self/goldens.js --update leaves no diff; node scripts/security-scope.mjs; node bench/json-compare/run.mjs --rounds 9 --mb 128 --record
    status: pending
    todos:
      - id: errors-pinned
        content: "Before touching the tokenizer: pin, on main, the error code and errorAt offset the tokenizer gives for every JSONTestSuite n_ file and every conformance-corpus input that fails, as a checked-in expected list that a tests/run.js json section (or tests/link/std_json_tokenizer) compares against, so the build cannot move one without a red test — see Errors stay the scalar code's"
        status: pending
      - id: spike
        content: "Spike first, as S6a did: the walker and kernel on the tokenize loop alone, rebuilt from the same IR as the built form, timed on twitter and citm. If the spike cannot reach 1.5x on both, stop: push what exists as a draft PR with the figures recorded in docs/wp38-simd.md and do not build the rest — see The spike"
        status: pending
      - id: probe
        content: "Split runtime/runtime-aes.c's carry-less-multiply test out of nish_aes_cpu into a probe of its own that both units call; nish_aes_hw keeps its answer and the NISH_AES pin exactly as today; tests/run.js aes and tests/simd/aes-gcm.c unchanged and green — see The probe"
        status: pending
      - id: kernel
        content: "Add runtime/runtime-json-index.c: one function declared in runtime/nish.h that indexes the 64-byte blocks of [from, to) into a word buffer and updates a small carry record (in-string, odd backslash run, last byte's class, unfinished UTF-8 sequence, first ill-formed offset); bits per the design (structural outside strings, string-delimiting quotes, pseudo-structural starts, backslashes and control bytes inside strings); escaped quotes by simdjson's carry arithmetic; prefix XOR by PCLMULQDQ/PMULL behind the new probe, six shifts and XORs elsewhere and on wasm simd128; scalar, SSE2/AVX2, NEON and wasm paths; Keiser–Lemire UTF-8 measured against marking bytes >= 0x80 in strings, kept only if faster on twitter and not slower on citm. Its own unit with its own .text ceiling in tests/runtime-budgets.js, wired into scripts/build.sh, src/run-cache.ts, src/runtime.ts, tests/differential/soundness.js and the freestanding wasm pairing exactly as runtime-bytes.c is; on isPureRuntime's list and marked variable-time; std/crypto does not call it — see The kernel"
        status: pending
      - id: walker
        content: "Add the private walker to std/json-tokenizer.ts, recognised by module and name in src/kernels.ts as S6a's walks are (no public surface): the Nish meaning of the kernel, which Node runs; a fixed buffer of 64 words plus one block of carry, allocated once per tokenizer and kept across reset; the cursor (current word with bits below pos cleared) and its three cases; strings take the fast path only when the next set bit is the closing quote before the first ill-formed offset and within maxStringBytes, else S6a's scan from the quote; numbers, literals, open/close, skipValue and every limit on their scalar code. src/ gains the lowering, not a use (the rolling freeze) — see The walker"
        status: pending
      - id: agree
        content: "tests/simd/json-index.c (wired into the simd section like byte-runs.c, and into ci.yml's simd-arm64 job so the NEON path runs on arm64): every path agrees with the scalar path and with the Nish walker's bitmap on a fuzzed corpus that puts every class boundary, every backslash run length and every UTF-8 sequence (well-formed and each ill-formed shape) at every offset of a block and at every 4 KiB chunk cut — see The agreement test"
        status: pending
      - id: memory
        content: "A test that one tokenizer reset across many documents of different sizes allocates the index once, and that the buffer is 4,096/8 bytes plus one block plus the carry record whatever the document's size; a caller that stops early (jsonFields) indexes only the chunks it reads — see Memory"
        status: pending
      - id: records
        content: "Security record for runtime/runtime-json-index.c (scope, findings fixed with before/after tests or recorded open) and its index row in docs/security/README.md so node scripts/security-scope.mjs passes; THIRD_PARTY_NOTICES.md row and kept upstream notice for any simdjson routine ported (.claude/licensing.md); docs/wp7-runtime.md and docs/MASTER_PLAN.md for the new unit's size, and the new unit added wherever runtime-bytes.c is listed as a unit to link (docs/INSTALL.md's link commands, docs/ARCHITECTURE.md, AGENTS.md, README.md, .claude/selfhost.md, tests/nish/run.ts) — see Records"
        status: pending
      - id: bench
        content: "Interleaved A/B against main on every bench/json-compare workload and bench/json-tokenizer's 242-byte body, with a byte-identical copy for the noise band; then node bench/json-compare/run.mjs --rounds 9 --mb 128 --record against simdjson and the others into docs/BENCHMARKS.md. Update the S6c row in docs/wp38-simd.md §7 with Met or Not met and the figures against the 96899c11 record (twitter 737,985 ns, citm 1,468,015 ns at the minimum; the bar is <= 491,990 and <= 978,677) and against simdjson in the same rounds. Commit carries a Measured: trailer. Do not tune until the figures pass — see The record"
        status: pending
      - id: goldens
        content: "Regenerate tests/self/goldens/checked with node tests/self/goldens.js --update and tests/differential goldens if a positive case is added; read the diff"
        status: pending
---

# WP38 S6c — the structural index for JsonTokenizer

The design is `docs/wp38-simd.md` §7, *S6c, the structural index: the design*,
accepted by the owner as written. Where this plan and that section disagree,
that section wins. The bar is the S6c row in §7's table.

Two stages, in order, and the second waits to **start** on the first: its
existence depends on the gate's verdict. That is the one chain split this run
makes, because the gate is worth merging on its own — it is the stop rule.

## gate

**Owns:** `docs/wp38-simd.md`, `.claude/plans/wp38-s6c-structural-index.plan.md`

### The decision

§8's Q5 row today reads "Design written, awaiting the owner (2026-10-23)".
It becomes the owner's acceptance of the §7 design as recommended, dated
2026-10-24, conditional on this gate. The S6c row in §7's table changes from
"awaiting the owner" to "accepted (§8, Q5); gate measured", followed by the
verdict.

### The split

Callgrind, not wall time, because the question is what fraction of the work
the index can remove at all. Run it on main's head, on the tokenize loop
bench/json-compare times, for twitter.json and citm_catalog.json, built as the
benchmark builds Nish (`--link --profile speed`). Use
`--dump-instr=yes` and `callgrind_annotate --auto=yes` (or `--inclusive`) so
the split can be done per source line of `std/json-tokenizer.ts`, as earlier
S6 sections did (see *S6a, the byte-class kernels: what was built* for the
precedent's form).

Removable is only what the design removes: the per-byte steps between tokens
(blank skipping by the cursor instead of a loop), the first-byte dispatch the
mark answers, and for strings whose next mark is the closing quote, the
kernel call, its setup and its scan. Everything else is kept, including
`stringInto`'s copy and S6b's number parser. Then add back what the index
costs: the walker's per-token `ctz`/clear/refill-check (estimated from a
count of tokens times a stated per-token instruction count, stated as an
assumption), and the kernel's measured instructions per byte from a throwaway
C prototype under callgrind.

### The verdict

`ceiling = total / (kept + walker + kernel)` per file. REACHABLE only if both
ceilings are at least 1.5x with the assumptions written down, since
instructions are a ceiling on wall time, not a prediction of it. If either
is below, write NOT REACHABLE, the ceilings, and what would have to move.
The PR does not build anything either way.

## build

Starts only after `gate` merges with a REACHABLE verdict.

**Owns:** `runtime/runtime-json-index.c` (new), `runtime/nish.h`,
`runtime/runtime-aes.c` (the probe split only), `std/json-tokenizer.ts`,
`src/kernels.ts`, `src/runtime.ts`, `src/run-cache.ts`, `src/std-modules.ts`
(only if the walker's recognition needs it), `scripts/build.sh`,
`tests/simd/json-index.c` (new), `tests/simd/calls-kernel.c`, `tests/run.js`,
`tests/runtime-budgets.js` (the new unit's budget and recorded sizes; never
another unit's budget), `tests/differential/soundness.js`,
`tests/differential/**` (regenerated only), `tests/link/std_json_tokenizer/**`,
`tests/link/std_json_conformance/**`, `tests/json-suite/**` (the pinned error
list only), `tests/self/goldens/checked/**` (regenerated only),
`.github/workflows/ci.yml` (the simd-arm64 job's agreement run only),
`.github/workflows/interop.yml` (the paths filter only), `docs/security/**`,
`THIRD_PARTY_NOTICES.md`, `docs/BENCHMARKS.md`, `docs/wp38-simd.md`,
`docs/wp7-runtime.md`, `docs/MASTER_PLAN.md`, and where they list the runtime
units beside `runtime-bytes.c` only: `docs/INSTALL.md` (the manual link
commands), `docs/ARCHITECTURE.md`, `docs/IR_COOKBOOK.md`, `AGENTS.md`,
`README.md`, `.claude/selfhost.md`, `tests/nish/run.ts`;
`.claude/plans/wp38-s6c-structural-index.plan.md`.

No `docs/guide/` change: the walker is private and the tokenizer's API and
diagnostics do not change. If any user-visible behaviour does change, that is
a finding, not a guide edit.

### Errors stay the scalar code's

First commit, on main's tokenizer: the pinned list of (file, error code,
errorAt) for every JSONTestSuite `n_` file and every failing conformance
input. Every later commit is checked against it. JSONTestSuite verdicts, the
fuzz checksum and #582's mutation-pinned boundaries are also unchanged.

### The spike

The order of work is S6a's: callgrind (the gate), then a spike rebuilt from
the same IR as its built form, then the build. Read S6a's note on layout under
LTO before trusting a gap between the spike and the built form. A spike that
cannot reach the bar ends the stage as a draft PR with the figures.

### The probe

`nish_aes_cpu` asks for PCLMULQDQ/PMULL in the same test as AES (and SSSE3 on
x86-64). Extract the carry-less-multiply test into its own probe, called by
both units; `nish_aes_hw` and the `NISH_AES` pin answer exactly as today.
Nothing else in `runtime-aes.c` changes.

### The kernel

As the design says, one function in `runtime/nish.h` with contract
`0 <= from <= to <= length` and an output buffer large enough for the chunk;
its own unit with its own ceiling, paired on freestanding wasm as
`runtime-bytes.c` is. Chunk size starts at 4,096 and is chosen by measurement;
the whole-window alternative is measured only if the refill check shows in
callgrind.

### The walker

Private, in `std/json-tokenizer.ts`, recognised by module and name. It is the
meaning Node runs, and the kernel must agree with it. `src/` gains the
lowering, not a call to anything new (`.claude/selfhost.md`, the rolling
freeze).

### The agreement test

Like `tests/simd/byte-runs.c`: every path against the scalar one and against
the walker's bitmap, every boundary at every block offset and chunk cut.

### Memory

At most one bit a byte plus one block, reused across documents: 512 bytes of
words plus one block of carry and the state record, allocated once.

### Records

`runtime/runtime-json-index.c` reads untrusted input, so it lands with its
`docs/security/` record and index row. Ported simdjson code keeps its notice
and gets its `THIRD_PARTY_NOTICES.md` row.

### The record

The A/B, then `--record`. The bar is against the 96899c11 record
(`docs/BENCHMARKS.md`, *JSON against other languages*, 2026-10-23): tokenize
twitter at most 491,990 ns and citm at most 978,677 ns at the minimum; typed
decode of citm faster than main outside its band; canada, typed-reuse,
serialize and bench/json-tokenizer not slower outside their bands. If the bar
is missed, record the figures as they are and say so in the S6c row.
