---
name: WP38 S6a follow-up — JsonWriter's escape scan on a byte-class kernel
overview: S6a (#862) put JsonTokenizer on nish/bytes' byte-class run kernels but left JsonWriter unchanged, so S6a's serialize condition is unmet (docs/wp38-simd.md §7, the S6a row and "S6a, the byte-class kernels: what was built" → "Not done"). This adds the fourth class the writer needs — every byte the writer copies unescaped, including bytes of 0x80 and above, which it passes through without validating — as a runtime-bytes.c kernel and a nish/bytes walker, and moves JsonWriter's string writer onto it, with copyBytes for the plain runs and no call for a short string.
stages:
  - id: writer-escape-kernel
    title: "perf(runtime): JsonWriter's escape scan on a byte-class kernel"
    goal: Serialize of bench/json-compare citm_catalog.json is faster than the current record outside its band, with no workload slower outside its band, the writer's output byte for byte unchanged, and the result recorded in docs/BENCHMARKS.md and docs/wp38-simd.md
    verification: npm run check, npm run lint, an undegraded npm test, node tests/run.js wasi (WASI_SYSROOT=/usr) and node tests/run.js performance green; tests/simd/byte-runs.c passes under its tests/run.js section; the bench/json-compare A/B against main is recorded
    status: completed
    todos:
      - id: kernel-class
        content: Add the fourth class to runtime/runtime-bytes.c — a run of bytes JsonWriter copies unescaped (0x20–0xff except `"` and `\`, no UTF-8 check), on the scalar, SSE2/NEON/simd128 and AVX2 paths behind the existing resolver, exported under the `nish_bytes_skip_` prefix scripts/build.sh keys on, with the unit within RUNTIME_BYTES_TEXT_BUDGET's 1,536 bytes — see The kernel
        status: done
      - id: kernel-agree
        content: Extend tests/simd/byte-runs.c so the scalar, 16-byte and 32-byte paths agree on the new class with every class boundary (0x1f/0x20, `"`, `\`, 0x7f/0x80, 0xff) at every offset of a block — see The agreement test
        status: done
      - id: bytes-walker
        content: Add the nish/bytes walker (std/bytes.ts, src/std-modules.ts) lowered by bytesWalkOf in src/kernels.ts, clamping its range and never panicking like the other runs, on isPureRuntime's list and marked variable-time, with tests/link/std_bytes_runs and its golden .ll covering it — see The walker
        status: done
      - id: writer-use
        content: "Done, narrowed by the owner to JsonWriter's u8[] writers: keyBytes and stringBytes (jsonWriterPutBytes) hand a window of 16 bytes or more to jsonWriterPutRuns, which copies each skipJsonPlain run with copyBytes and escapes only where the walker stops; a shorter window keeps the byte loop. The guard was measured at lengths 4 to 64 (the kernel loses below 16 bytes and wins from 16, where its first SIMD block starts). jsonWriterPutString (string keys and values, jsonEncode's path) and src/emit*.ts are unchanged; tests/link/std_json_writer sweeps every length from 1 to 80 with escapes and high bytes at the guard and the run boundaries against the rule — see The writer"
        status: done
      - id: ab-record
        content: "Done: interleaved A/B against main on every bench/json-compare workload, bench/json-tokenizer and a JsonDocument.write bench (stringBytes' one in-tree caller), recorded in docs/wp38-simd.md (*JsonWriter's byte writers*, with the serialize profile and its Amdahl ceilings) and a note after docs/BENCHMARKS.md's JSON section. The S6a row's serialize verdict now says the condition is not reachable by the escape scan on citm (whole-scan ceiling 1.137x, 16-byte-guard ceiling 1.0139x, inside the 1.4% band) and names number writing as the next lead — see The record"
        status: done
      - id: docs-surface
        content: Document the walker in docs/LANGUAGE.md's byte-runs rule, std/README.md, docs/guide/using-nish/standard-library.md and docs/IR_COOKBOOK.md where the other runs are; regenerate tests/self/goldens with node tests/self/goldens.js --update and read the diff — see The surface
        status: done
---

# WP38 S6a follow-up — JsonWriter's escape scan on a byte-class kernel

One stage, one PR. The kernel, its walker and its one caller are one change:
a kernel with no caller cannot be measured against the bar, and the caller
cannot be written before the walker exists.

## writer-escape-kernel

**Owns:** `runtime/runtime-bytes.c`, `tests/simd/byte-runs.c`, `src/kernels.ts`,
`src/std-modules.ts`, `std/bytes.ts`, `std/json.ts`, `std/README.md`,
`tests/link/std_bytes*/**`, `tests/run.js`, `tests/runtime-budgets.js` (its
recorded size only, never the budget), `tests/self/goldens/checked/**`,
`tests/differential/**` (regenerated only), `docs/BENCHMARKS.md`,
`docs/wp38-simd.md`, `docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`,
`docs/guide/using-nish/standard-library.md`, `scripts/build.sh` (only if the
unit's inclusion rule must name the new symbol),
`.claude/plans/wp38-s6a-writer-escape.plan.md`.

### The kernel

`runtime/runtime-bytes.c` already has three classes behind one `cls` switch
(`nish_run_in`, `nish_run_stops_*`) and one resolver. The fourth class is
"a byte JsonWriter writes as itself": 0x20 to 0xff except `"` (0x22) and
`\` (0x5c). It differs from `skipJsonText` in two ways, and both are the point:
bytes of 0x80 and above are in the class with no UTF-8 check (the writer passes
them through unvalidated today and must keep doing so), and 0x7f is in the
class as it is now. Check `std/json.ts`'s current escape rule before fixing the
class: the class must be exactly the set of bytes the writer copies unchanged,
so the output does not move by a byte.

Keep the unit within `RUNTIME_BYTES_TEXT_BUDGET` (1,536 bytes of `.text*`; it is
at 1,303). If the fourth class does not fit, say so with the measured size
rather than raising the budget. Raising it is a decision for the owner.

### The agreement test

`tests/simd/byte-runs.c` already proves the paths agree for three classes. The
new class gets the same treatment: for every block offset of the widest path,
place each boundary byte (0x1f, 0x20, 0x21, 0x22, 0x5b, 0x5c, 0x5d, 0x7f, 0x80,
0xff) and check that the scalar, 16-byte and 32-byte paths return the same index,
including runs that end at `to` and ranges shorter than a block.

### The walker

Follow `skipJsonText`'s path end to end: `std/bytes.ts`'s declaration, the
`src/std-modules.ts` entry, `bytesWalkOf` in `src/kernels.ts`, `isPureRuntime`,
the variable-time mark, and `tests/link/std_bytes_runs`. Name it for what the
writer needs (for example `skipJsonPlain`), and settle the name in
`docs/LANGUAGE.md`. `src/` gains the lowering, not a use: the rolling freeze
(`.claude/selfhost.md`) forbids `src/` calling the new function before a
release ships it.

### The writer

`JsonWriter`'s string writer (`std/json.ts`, `class JsonWriter`) escapes byte
by byte today. After the change, it finds the next byte that needs an escape
with the walker, copies the run before it with `copyBytes`, writes the escape,
and continues. The writer's output for every input stays byte for byte as it
is now: the differential tests against Node's `JSON.stringify`, the serialize
expected output in `bench/json-compare`, and the conformance corpus prove that.

Short strings pay no call, as the tokenizer's do: measure the guard (S6a found
two bytes right for blanks and none for digits), then record the length chosen
and the measurement behind it.

### The record

An interleaved A/B against `main` on `bench/json-compare` (the rounds, minima
and noise band as `docs/BENCHMARKS.md`'s JSON section does them), covering
every workload it runs, plus `bench/json-tokenizer`. The bar: serialize on
citm_catalog.json faster than the current record (`docs/BENCHMARKS.md`,
*serialize, citm_catalog.json*) outside its band, and nothing slower outside
its band. If the bar is missed, record the figures as they are and say so in
the S6a row. Do not tune until the figures happen to pass. Follow S6a's own
note on layout under LTO before you trust a gap between a spike and its built
form. The commit carries a `Measured:` trailer (`.claude/testing.md`).

### The surface

A new `nish/bytes` function is something a user of Nish can see, so its rule,
cookbook entry and guide paragraph go in this PR (`CLAUDE.md`, "The user guide
moves with the language").
