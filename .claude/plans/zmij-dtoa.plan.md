---
name: Faster double formatting — Żmij digits, a two-digit writer, and JSON f64 without a string
overview: Replace the Ryu port behind String(x) with a port of Żmij (the yy / Schubfach-family algorithm, one 192-bit multiply per number), write its digits and exponent without a per-digit divide or snprintf, then let JsonWriter put an f64 straight into its buffer through a runtime kernel instead of building and copying a string.
stages:
  - id: zmij-digits
    title: "perf(runtime): shortest digits from Żmij, written two at a time"
    goal: Native String(x) prints exactly what it prints today (and what Node prints), measurably faster, with no Ryu-derived code or licence left in the tree
    verification: npm run check && npm run lint && node tests/run.js runtime_test && node tests/run.js runtime_sanitize && node tests/run.js runtime-budget && node tests/run.js third-party-licence && node tests/run.js f64_format_oracle && node tests/run.js f64_shortest && WASI_SYSROOT=/usr node tests/run.js wasi && node scripts/security-scope.mjs && node docs/check-links.mjs
    status: pending
    todos:
      - id: zmij-port
        content: Replace nish_shortest_digits in runtime/runtime.c with a port of Żmij's scalar to_decimal_double (no SIMD, none of Żmij's own formatting), keeping the ECMAScript layout — see Żmij digits
        status: pending
      - id: pow10-table
        content: Add scripts/gen-pow10-table.py deriving the 128-bit 10^k table with exact integer arithmetic, and delete scripts/gen-pow5-tables.py — see The table
        status: pending
      - id: digit-writer
        content: Factor nish_str_from_f64 into nish_f64_format(v, out) plus the string wrapper, and write digits two at a time and the exponent without snprintf — see Digit writer
        status: pending
      - id: oracle
        content: Add tests/f64-format-oracle.c and a tests/run.js section f64_format_oracle comparing native output with Node String(x), and extend tests/runtime-test.c with the edge classes — see Validation
        status: pending
      - id: licence-swap
        content: Ship Żmij's notice and licence, remove runtime/LICENSE-ryu and every pointer to it (THIRD_PARTY_NOTICES.md, .claude/licensing.md, release.yml presence gates, the pack list in tests/run.js) — see Licence
        status: pending
      - id: measure-zmij
        content: Add bench/f64-format.ts, measure base vs new with a noise band, check the runtime .text budget and the .rodata and bench/nbody size, and record all of it in docs/wp15-performance.md §7a and docs/wp7-runtime.md — see Measurement
        status: pending
      - id: security-zmij
        content: Update docs/security/runtime.md (scope wording, the formatter buffer row) for the new formatter — see Security
        status: pending
  - id: json-f64
    title: "perf(runtime): JsonWriter writes an f64 without building a string"
    goal: A native JsonWriter puts an f64's digits straight into its u8[] buffer through a runtime kernel, byte-identical to JSON.stringify, while Node keeps running the Nish body
    verification: npm run check && npm run lint && node tests/run.js std_json_writer && node tests/run.js runtime_test && node tests/run.js runtime-budget && node tests/run.js json_f64_seam && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node scripts/security-scope.mjs
    status: pending
    todos:
      - id: json-kernel
        content: Add nish_json_put_f64(buf, len, at, v) to runtime/runtime.c on top of nish_f64_format, declared in runtime/nish.h, with tests/runtime-test.c cases — see JSON kernel
        status: pending
      - id: json-seam
        content: Make jsonWriterPutF64 in std/json.ts a private seam the emitter replaces with the kernel (src/kernels.ts, src/std-modules.ts, src/runtime.ts, the emitter), as std/bytes.ts's walks are — see JSON seam
        status: pending
      - id: json-tests
        content: Pin the seam with a golden .ll case and a root-package std/json.ts negative, and keep std_json_writer byte-identical under native and Node — see JSON tests
        status: pending
      - id: json-measure
        content: Add f64 documents to bench/json-writer, measure base vs new with a noise band, and record it in docs/wp15-performance.md — see JSON measurement
        status: pending
      - id: json-security
        content: Name the kernel in docs/security/runtime.md and docs/security/json.md (bounds of the buffer write) — see JSON security
        status: pending
---

# Faster double formatting

## Context

`String(x)`, a template hole of type `f64` and `JsonWriter.f64` all end in [`nish_str_from_f64`](../../runtime/runtime.c) on native and WASI. Its digits come from `nish_shortest_digits`, a Ryu port (WP15 §7a: 72 ns per number, 9,888 bytes of tables). JS hosts and `--emit-ts` format with the engine and are untouched by this plan.

[yy-dtoa](https://vitaut.net/posts/2026/yy-dtoa/) describes the algorithm in yyjson's `yy_double.c`; [Żmij](https://github.com/vitaut/zmij) (Victor Zverovich, MIT **or** BSL-1.0, with a plain C version `zmij.c`) now uses it as its core. It scales by one 128-bit power of ten (one 192-bit product) where Ryu makes three, derives the rounding interval by shifting the table entry, and has no trailing-zero slow path. Its README claims ~3.8x over Ryu (EPYC, GCC) and >7x (M5, Clang); we measure our own.

## Approach

- **Port Żmij's C, not yyjson's.** Żmij is the maintained C form of yy, it offers BSL-1.0 (which `.claude/licensing.md` prefers because it exempts object code, as for Ryu), and its scalar path is self-contained.
- **Port only the scalar shortest path.** `to_decimal_double` (regular and irregular branches), `compute_dec_exp`, `compute_exp_shift`, the umul helpers on `__uint128_t`, and the trailing-zero trim. No SIMD, no `ZMIJ_USE_*` switches, no float32, no fixed-precision or big-integer paths, none of Żmij's output layout: the ECMAScript layout in `nish_str_from_f64` stays ours.
- **The algorithm's only output is the decimal significand and exponent.** The digit writer is a separate, ordinary piece of code ours to write.
- **JSON reuses the formatter, never duplicates it.** Stage 2 calls the `nish_f64_format` that stage 1 introduces; that is the merge-order edge.

## Stage zmij-digits

**Owns:** `runtime/runtime.c`, `runtime/nish.h`, `runtime/LICENSE-ryu`, `runtime/LICENSE-zmij`, `scripts/gen-pow5-tables.py`, `scripts/gen-pow10-table.py`, `scripts/size-report.sh`, `THIRD_PARTY_NOTICES.md`, `.claude/licensing.md`, `.claude/architecture.md`, `.github/workflows/release.yml`, `tests/run.js`, `tests/runtime-test.c`, `tests/runtime-budgets.js`, `tests/f64-format-oracle.c`, `tests/cases/f64_*`, `bench/f64-format.ts`, `bench/run.mjs`, `bench/README.md`, `docs/wp15-performance.md`, `docs/wp7-runtime.md`, `docs/security/runtime.md`, `tests/self/goldens/checked/**`, `tests/differential/goldens/**`

Sections: Żmij digits, The table, Digit writer, Validation, Licence, Measurement, Security.

## Stage json-f64

**Owns:** `runtime/runtime.c`, `runtime/nish.h`, `std/json.ts`, `src/kernels.ts`, `src/std-modules.ts`, `src/runtime.ts`, `src/emit-*.ts`, `src/attributes.ts`, `src/secret.ts`, `src/panics.ts`, `src/capabilities.ts`, `src/parallel.ts`, `tests/run.js`, `tests/runtime-test.c`, `tests/runtime-budgets.js`, `tests/nish-cmp.js`, `tests/cases/json_f64_*`, `tests/link/std_json_writer/**`, `bench/json-writer/**`, `docs/cookbook/runtime-prelude.*`, `docs/IR_COOKBOOK.md`, `docs/wp15-performance.md`, `docs/security/runtime.md`, `docs/security/json.md`, `tests/self/goldens/checked/**`, `tests/differential/goldens/**`

Depends on zmij-digits to **start**: it consumes `nish_f64_format`. Split rather than merged with it because zmij-digits is worth landing alone and the two together are more than one review.

Sections: JSON kernel, JSON seam, JSON tests, JSON measurement, JSON security.

## Żmij digits

In [`runtime/runtime.c`](../../runtime/runtime.c), replace the Ryu block (header comment, `NISH_POW5_*` tables, `nish_pow5bits`, `nish_log10pow2`, `nish_log10pow5`, `nish_pow5factor`, `nish_mulshift`, `nish_shortest_digits`) with the Żmij port under `nish_` names. The block opens with the upstream notice in the form `THIRD_PARTY_NOTICES.md` uses (project, file `zmij.c`, `Copyright (c) 2025 - present, Victor Zverovich`, BSL-1.0 taken from its MIT-or-BSL offer, path of the licence text). Keep the contract `nish_str_from_f64` relies on: finite positive input, digits plus a decimal exponent. Round half to even on exact ties, as ECMAScript's `s` requires and as both Ryu and Żmij do.

## The table

Żmij keeps `pow10_significands[649]` (10^-307 … 10^341 as 128-bit significands, ~10.4 KB). Commit the table generated by a new [`scripts/gen-pow10-table.py`](../../scripts/) that derives each entry with exact integer arithmetic and asserts it against Żmij's rounding convention, and delete [`scripts/gen-pow5-tables.py`](../../scripts/gen-pow5-tables.py). Point every mention of the old script (`scripts/size-report.sh`, docs) at the new one.

## Digit writer

Split `nish_str_from_f64` into `int nish_f64_format(double v, char out[NISH_F64_MAX])` (returns the length, writes no NUL, declared in `runtime/nish.h` for stage 2) and the thin wrapper that makes the `nish_str`. In the formatter, emit the significand two digits at a time from a 200-byte `"00".."99"` table straight into place (no reverse pass), and write `e+N`/`e-N` with the same table instead of `snprintf`. `NISH_F64_MAX` stays at the current 32 and the security record's "25 used at most" claim is re-derived, not assumed.

## Validation

- **Oracle:** `tests/f64-format-oracle.c` links `runtime.c` and prints `nish_f64_format` for a seeded stream; the `f64_format_oracle` section in `tests/run.js` compares every line with Node's `String(x)`. The stream: 2,000,000 random bit patterns plus every class below. Exit non-zero on the first difference, naming the bits.
- **Edge classes** (also as `expect_f64` rows in [`tests/runtime-test.c`](../../tests/runtime-test.c)): every power of two from 2^-1074 to 2^1023 (the irregular interval), the subnormal/normal boundary, `DBL_MAX`, `5e-324`, the four values in [`tests/cases/f64_shortest_digits.ts`](../../tests/cases/f64_shortest_digits.ts), exact ties, `1e21` and `1e-7` (layout switch points), integers up to 2^53, `-0`, NaN, ±Infinity.
- **One-off, recorded in the PR body, not in CI:** a 100M-value oracle run, and a byte-for-byte diff of the new formatter against the base commit's Ryu over the same stream (build the base `runtime.c` from git, do not vendor it).

## Licence

Per [`.claude/licensing.md`](../licensing.md): add `runtime/LICENSE-zmij` (Boost 1.0 text verbatim, the licence taken), delete `runtime/LICENSE-ryu`, replace the Ryu sections and table row in [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md), update the Ryu examples in `.claude/licensing.md`, the three `runtime/LICENSE-ryu` presence gates in [`.github/workflows/release.yml`](../../.github/workflows/release.yml) (lines 334, 425, 572, path swap only) and the pack `required` list in `tests/run.js` (~25263). `node tests/run.js third-party-licence` is the check. The PR body names upstream, file, licence and what was taken, function by function.

## Measurement

`bench/f64-format.ts` formats a fixed, seeded mix (random bits, short decimals like `0.1`, integers) and reports ns per number. Measure base and new per `.claude/testing.md` → "A `Measured:` trailer", with a byte-identical base copy for the noise band. Also record: the runtime `.text` budget result (`tests/runtime-budgets.js`, 3,698 bytes; exceeding it is allowed only with the measured win in the PR, per WP15 §7, and the budget moves in the same PR), the `.rodata` delta, and `bench/nbody`'s size before/after. Rewrite WP15 §7a and the `docs/wp7-runtime.md` table line; fix the stale `.claude/architecture.md` budget figures if the budget moves.

## Security

[`docs/security/runtime.md`](../../docs/security/runtime.md): the scope row says "Ryu formatters" — rename, and re-check the formatter buffer row (32 bytes, longest output) against the new writer, pinned by `runtime-test.c`. Record any finding with a before/after test, or none.

## JSON kernel

`int32_t nish_json_put_f64(uint8_t *buf, int32_t len, int32_t at, double v)` in `runtime/runtime.c`: formats into a stack buffer with `nish_f64_format`, then copies only if `0 <= at` and the bytes fit before `len`; returns the new end, or -1 when it does not fit (the caller sets `JSON_WRITE_FULL`, as `jsonWriterPutText` does). Same output as `nish_str_from_f64` (`-0` as `0`). Non-finite values are the Nish caller's business, as today. Unit rows in `tests/runtime-test.c`: fits exactly, one byte short, `at` negative, `at == len`, `-0`, the longest output.

## JSON seam

Follow the `std/bytes.ts` walk precedent ([`src/kernels.ts`](../../src/kernels.ts) `bytesWalkOf`, [`src/std-modules.ts`](../../src/std-modules.ts) `isBytesModule`, [`src/runtime.ts`](../../src/runtime.ts) declares): a private function in [`std/json.ts`](../../std/json.ts) (the present `jsonWriterPutF64` body, or a `putF64Walk` it calls) keeps its Nish body for Node and `--emit-ts`, and the emitter replaces the call with `nish_json_put_f64` only when the module is the standard library's `std/json.ts`. `src/` does not use the new symbol in its own source, so the rolling freeze does not apply (`.claude/selfhost.md`), but the bootstrap job must stay green. Regenerate `tests/self/goldens/checked/` with `node tests/self/goldens.js --update`. No user-visible change, so no guide page.

## JSON tests

- A golden `tests/cases/` program writing f64s through `JsonWriter`, with its `.ll` showing the `nish_json_put_f64` call, an `llvm-as` pass and expected stdout; register it with `node tests/differential/goldens.js --update`. The `json_f64_seam` section in `tests/run.js` checks that the IR has the call and no `nish_str_from_f64` for the writer.
- A negative: a root-package file at `std/json.ts` is an ordinary module and gets no kernel (mirror the bytes precedent's test).
- `std_json_writer` stays byte-identical to `JSON.stringify` under native and Node, and the arena-flat check in `tests/link/std_json_writer` still holds.

## JSON measurement

Add an f64-heavy document (seeded random doubles and short decimals) to [`bench/json-writer`](../../bench/json-writer/). Measure base vs new as in stage 1 and record it in WP15. If the win is inside the noise band, open the PR as a draft and say so: the seam is not worth carrying without a measured win.

## JSON security

The kernel writes into a caller's buffer at a caller's offset: add it to `docs/security/runtime.md`'s scope and a row for its bounds (pinned by the unit rows above), and a line in `docs/security/json.md` that the writer's f64 path no longer allocates. `node scripts/security-scope.mjs` passes.

## Out of scope

- Parsing (`strtod`, the JSON tokenizer's number path).
- float32 formatting, `toFixed`/`toPrecision`/`toExponential`.
- JS-host and `--emit-ts` formatting, which the engine does.
- Any SIMD from Żmij.

## Verification

Each stage's `verification` line, read by exit status. CI's four `test` shards on the current head are the full-suite gate. `node tests/run.js performance` for stage 2 (a `src/` change).

### Run notes for /feature

- **Targeted test command:** `node tests/run.js <section>`.
- **Full suite:** CI's four `test` shards on the current head, per [CLAUDE.md](../../CLAUDE.md#definition-of-done). A local `npm test` only for the exceptions it names.
- **No coverage command.** As in earlier runs, the gate is the repo's definition of done (an undegraded full suite in CI's `test` shards, the targeted sections above, lint, typecheck and the security scope) plus a negative test for every refusal.
- **Generated globs:** `tests/self/goldens/checked/**`, `tests/differential/goldens/**`.
