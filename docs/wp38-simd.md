# WP38: SIMD — which loops get vectors, and how a program asks for them

**Status: accepted; S0 and S1's kernel and surface landed, S1's `bench/json`
bar missed and S1b proposed, S2's bar met on a re-measurement and its flag built (`d835d40`), S4 declined for now, S5's 5x bar met, S6 proposed, S7 met by #561, S3a and S2 decided and planned (tracking issues #516 and #577).** The owner took the
first four decisions in §8 on 2026-10-09, as recommended. S0's baselines are in §2.3
(#517). S1's kernel, `runtime/runtime-simd.c` (#518), and its `std/text`
function, `indexOfAny` (#519), are built. No way of moving `std/json` onto it
was reliably faster than S0 on `bench/json`, and none came near 1.5x, so
`std/json` is unchanged (§2.3); whether to design S1b, the block classifier,
is the owner's call (§7).
A second kernel shares S1's file, path store and `NISH_SIMD` pin:
`nish_regex_scan` finds where a `nish/regex` match can start, testing up to
three positions of a pattern's leading byte sets for thirty-two starts at
once on AVX2, a nibble lookup in each of the 32-byte forms, and simd128 or
NEON at sixteen. `std/regex.ts`'s walker `regexScanFrom` is recognised as
`indexOfAny`'s is ([IR_COOKBOOK](IR_COOKBOOK.md#nishregex-a-matchs-first-byte-on-the-runtime-kernel));
`tests/simd/regex-scan.c` holds every path to a reference loop.
S2's `--cpu` flag is built (`d835d40`): S0's figures missed its bar, and a
re-measurement against the noise met it (§7); the owner decided to build it.
What reading every level costs the constant-time checkers was measured: the
x86-64 levels and ARMv8 without SVE already pass, the SVE levels do not, and
`native` cannot be read. The owner decided on 2026-10-16 to build it with one
value, `x86-64-v3` (§7; §8, Q7), in [the S3a and S2 plan](../.claude/plans/wp38-s3a-cpu-flag.plan.md).
S4, the lexer on `indexOfAny`, is declined for now, because the lexer is too
small a part of the bootstrap to move it (§7). S3's bar now names the scalar
kernel it is judged against, and its operation list leaves out a fused
multiply-add, after a portable-vector benchmark's findings were checked
against LLVM 18 (§3.2.1). It waits for S3a, S3's two bar kernels measured
without a surface, and is decided on those figures (§8, Q8, decided
2026-10-16). S7, crediting an offset index from the test that bounds it, was
to come first, and turned out to be built already, by #561 (§7, S7). S5 put `std/crypto/aes.ts`'s key schedule, block,
GCTR and GHASH on AES-NI and PCLMULQDQ, and on ARMv8's AES and PMULL, as a
runtime kernel behind a run-time branch that keeps the bitsliced code as the
fallback: 38.5x on a 16 KiB AES-128-GCM seal (§2.3, §7). S6 puts `nish/json-tokenizer`'s byte runs on kernels, its numbers on
Eisel–Lemire and, last, its structure on a block classifier, each on its own
bar against the json-compare record of the json-parity run (§2.4, §7). S3 has no flag, type or runtime
symbol yet: it arrives with its stage, and its rule goes into
[LANGUAGE.md](LANGUAGE.md) then. [MASTER_PLAN.md](MASTER_PLAN.md) lists the
work as additive. LANGUAGE.md stays normative and this note adds no rule to
it; where they disagree, LANGUAGE.md wins.

The question came from `bench/json`, the cross-language JSON benchmark of
#507. In its recorded report Nish's `std/json` read three fields per line in
about the time Go's gjson took, and simdjson in about a third of that. #499,
#500 and #507's own stages narrow the gap without SIMD, but do not close it. simdjson is a SIMD
structural indexer, so the gap raises a wider question: what SIMD should the
language have? This note answers it in four parts. §2 says what vectorises
today and what does not, with the test or the record for each claim. §3 sets
out four ways to get further, each judged by
[wp33-round-trip.md](wp33-round-trip.md) §6's rule: every construct states its
TypeScript reading, and none costs the native build of a program that does
not use it. §5 and §6 cover the target policy and constant-time code. §7
gives the order of the stages and the measured bar each must clear before it
ships.

---

## 1. The decision

**Put vectors where the bytes are, behind ordinary functions, before giving
programs vector types. Keep the default target at the baseline CPU.** Five
rules:

1. **Runtime kernels come first (§3.1).** These are a few byte-search
   primitives in a new runtime unit with its own size ceiling, written for the
   16-byte vectors every 64-bit target has: SSE2 on x86-64, NEON on AArch64.
   A wider path is chosen at run time, per kernel, on its first call.
   Programs reach them through `std` functions that are ordinary Nish
   loops. The compiler recognises such a function and replaces the one inner
   call that walks the bytes with the kernel, keeping the rest of the body,
   the way it already does for `std/threads`. Under Node the loop runs, so the
   construct is class A.
2. **The default target stays the baseline CPU (§5).** `--profile speed` does
   not pass `-march` today, and it keeps not passing it. A wider target is an
   opt-in flag. It ships only when it clears a measured bar, and only once the
   constant-time checker reads what that flag emits.
3. **A `nish:simd` module of fixed 128-bit vector types comes third (§3.2),
   and only if it clears its bar.** Its operations are portable: they lower to
   LLVM vector IR, never to a named target instruction. Every operation has a
   lane-by-lane TypeScript reading. Integer lanes wrap, and their names say so,
   as `nish:unsafe`'s `wrappingAdd` does.
4. **No target intrinsics in the language (§3.3).** Each one would tie a
   program to an instruction set, and none has a TypeScript reading that is
   not an emulator. Where one is worth having, as AES-NI was (S5), it goes
   into the runtime behind a function, as rule 1 does for byte search.
5. **Auto-vectorisation stays the default way numeric code gets vectors
   (§3.4).** Getting more loops into a shape LLVM vectorises is ordinary work
   for the bounds and overflow pipelines (WP15, #426), and needs no surface.

---

## 2. What exists

### 2.1 What vectorises today

There are no vector types and no intrinsics in the language
(`runtime/nish.d.ts` declares neither). What vectorises is what LLVM's loop
vectoriser finds in counted loops. The suite pins that it does:

| What | Pinned by |
| --- | --- |
| A reduction over a counted loop vectorises under `--wrapping` | `tests/run.js`, "opt -O2 vectorises the cf_sum_loop reduction" (WP1) |
| The same loop under the checked default keeps its overflow exit and does **not** vectorise | `tests/run.js`, "cf_sum_loop_checked: … does not vectorise" |
| An array sum vectorises with `--unchecked-indexing`, and the checked one only once inlined with a constant length, because LLVM 18's vectoriser does not take multi-exit loops | `tests/run.js`, the WP4 `arr_sum` checks; [wp4-arrays.md](wp4-arrays.md) |
| An element loop vectorises once header and element accesses are in separate alias domains | `tests/run.js`, "arr_alias_domains: opt -O2 vectorises the element loop" (WP15 §2b) |
| `--target host` gives the module a data layout, so `opt -O2` vectorises it without `-mtriple` | `tests/run.js`, "opt -O2 vectorises opt_target_triple without -mtriple" (WP9) |
| A loop over an array held in a class field compiles to the same loop, register for register, as one over a `const` copy, so it vectorises where that one does. Before the header hoist (#104) and property-path facts (#179) the field shape was 2.38x behind and did not vectorise | `tests/run.js`, "arr_header_hoist: @fieldScale's loop is @constScale's, register for register"; [wp15-performance.md](wp15-performance.md) §2c |

At the baseline CPU those vectors fit 128-bit registers on x86-64. `scripts/build.sh`
gives clang `-O3 -flto` under `--profile speed` and no `-march`. Its comment
says the IR is target-neutral and "clang fills the triple in", so the CPU is
clang's baseline: SSE2 on x86-64. [bench/README.md](../bench/README.md) relies
on this for the instruction gate ("`--profile speed` does not pass `-march`"),
and so does the constant-time checker
([LANGUAGE.md](LANGUAGE.md#constant-time-ctselect-and-cteq),
[CT-16](security/ct-verification.md)).

The runtime has one hand-picked vector path. `s.indexOf(sub)` is a call to
`nish_str_index_of`, which looks for the first byte with libc `memchr` and
checks the rest with `memcmp` (`runtime/runtime.c`). glibc's `memchr` is
vectorised, and it chooses its width when the program starts. That took one
search on an 880 KB haystack from 53.7 ms to about 3 ms, **17–18x**
([wp15-performance.md](wp15-performance.md#7c-indexof-gets-a-real-algorithm--done)).
#507's first stage gives it a start position, so that a scanner can use it
mid-string.

### 2.2 What does not

A loop that stops at the first interesting byte has an exit that depends on
the data. LLVM 18 does not vectorise it, so it runs one byte per iteration.
These scanners all have that shape:

- **`std/json`.** `jsonEndOfString`, the in-string branch of `jsonEndOfValue`,
  `jsonSkipBlank`, the key compare and `jsonUnescape` each walk the text with
  `charCodeAt`. #507's stage 3 moves the string bodies onto the `memchr`
  search. The structure scan (depth, commas, colons) stays byte-wise.
- **The compiler's lexer.** `src/lexer.ts` walks comments, identifiers,
  numbers and string literals byte by byte. Each step is a `charCodeAt` in a
  `while` with an early exit. Self-compilation time is the compiler's own
  speed, and nothing gates it today ([wp33](wp33-round-trip.md) §9). §7
  records what the walk costs: about 1% of the front end.
- **`bench/scan.ts`.** This is the hot loop of a bytes-in JSON validator, kept
  as a proxy. As freestanding wasm it scans about 346 MB/s
  ([wp30-bytes-interop.md](wp30-bytes-interop.md)).

### 2.3 The numbers that motivate it

`bench/json` reads `code`, `line` and `message` from each of 100,000 lines
(43.8 MB). Its harness and its report, `docs/BENCHMARKS-json.md`, are on #507's
benchmark branch and not yet on `main`. The report, taken at 0.17.0, gave these
minima:

| Reader | min ms |
| --- | ---: |
| simdjson On-Demand | 36.8 |
| yyjson | 53.4 |
| serde_json, typed | 82.4 |
| gjson | 118.3 |
| Nish `std/json`, `jsonField` ×3 | 122.7 |

#499 measured 156.9 to 130.8 ms on its own machine. #507's plan records
about 90 ms after #500 on the report's machine, and its stage 3 trailer is the
figure that counts. Even at 90 ms simdjson is about 2.4x ahead, and what is
left to Nish is the structure scan, still one byte at a time (§2.2): the part
simdjson does with vectors.

The numeric side shows how much a wider target could buy, because
[BENCHMARKS.md](BENCHMARKS.md) times Rust at both `-O3` and
`-C target-cpu=native`, on the same machine as Nish's baseline build:

| Benchmark | Nish | Rust `-O3` | Rust native | native / `-O3` |
| --- | ---: | ---: | ---: | ---: |
| nbody | 1283 | 1382 | 1221 | 0.88x |
| vec3 | 396 | 436 | 394 | 0.90x |
| spectral | 498 | 460 | 466 | 1.01x |
| sieve | 717 | 1059 | 1076 | 1.02x |

Nish at the baseline already beats Rust `-O3` on three of the four. A wider
target bought Rust about 10–12% on the two float kernels and nothing on the
other two. So `-march` buys a little, and only on some programs (§3.4).

#### S0: the baselines

S0 measured these with `node bench/simd-s0.mjs`, with `main`'s compiler
(`f772bd2`; the branch adds only this note and that script). The scan and
bootstrap rows were taken at `97210d5`, and the `-march` rows at `c4dd861`,
once the script ran the two builds in alternating rounds. Between those
commits the script changed only in how it times, and in a comment. The machine
was an `Intel(R) Xeon(R) Processor @ 2.10GHz` (lscpu: family 6, model 207; 4
vCPUs under KVM; AVX2, FMA and AVX-512 present). Each row is seven runs after
one warm-up, in ms. Every later bar in §7 is a ratio against this table, on
this machine, so a stage that measures elsewhere re-runs the script there
first. The `bench/json` row is the exception: `s1-json` took it on its own
machine, with its own programs, in interleaved rounds against S1's variants,
under the owner's rule for that row
([below](#s1-stdjson-on-indexofany-the-bar-missed)).

| Row | Build | min ms | median ms |
| --- | --- | ---: | ---: |
| `bench/json`, `jsonFields` | `main` at `f33139a`, on another machine ([below](#s1-stdjson-on-indexofany-the-bar-missed)) | 75.7 | 77.7 |
| `bench/scan.ts`, 1,000 passes over 1 MiB | native, `--profile speed` | 1783.2 | 1942.9 |
| `bench/scan.ts`, the same passes | freestanding wasm under Node 22, through `scanBatch` | 2334.6 | 2644.2 |
| nbody | baseline | 1139.8 | 1195.8 |
| nbody | `-march=x86-64-v3` | 1093.5 | 1193.5 |
| vec3 | baseline | 420.0 | 439.1 |
| vec3 | `-march=x86-64-v3` | 408.5 | 440.5 |
| spectral | baseline | 567.4 | 634.4 |
| spectral | `-march=x86-64-v3` | 506.6 | 541.0 |
| `scripts/bootstrap.sh --verify` | seed to stage3 | 150771.2 | 153702.1 |

The scan rows are about 590 MB/s natively and 450 MB/s as wasm. The wasm
figure includes copying the document into linear memory on every pass, as
any host must. Both print the same checksum. Each pass first turns the `1` of
one more piece into a comma, so no pass scans the document the one before it
did.

The `-march=x86-64-v3` rows link the same `.ll` as the baseline rows. Only
clang's CPU changes, for the module (through LTO) and for the runtime alike,
and both binaries print the same checksum. The two binaries run in alternating
rounds, so a slow stretch of the shared machine falls on both columns. The
wider binary uses VEX encodings and `ymm` registers. It has no FMA, because the
IR carries no `contract` flag. The baseline binary has neither.

Both samples were taken at `c4dd861`. In that version the wide build went
first in four of the seven timed rounds, and in eight of the fifteen. The
script now rounds the count up to even, so each build goes first in exactly
half. A second sample of fifteen alternating rounds gave:

| Benchmark | baseline min | x86-64-v3 min | gain | baseline median | x86-64-v3 median | gain |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| nbody | 1089.8 | 1066.0 | 2.2% | 1153.2 | 1106.4 | 4.1% |
| vec3 | 406.8 | 411.5 | −1.2% | 423.6 | 427.9 | −1.0% |
| spectral | 506.2 | 398.4 | 21.3% | 533.4 | 454.2 | 14.8% |

The seven-round table above is S0's baseline: it follows §7's protocol, and
it is the one later stages divide by. The verdict below is read from both
samples, because they disagree on nbody and vec3. Neither one alone is enough
to settle a difference of one or two percent. The two baseline columns
differ by more than that between samples: spectral's baseline minimum was
567.4 ms in one and 506.2 ms in the other.

The first, unalternated run of this script, at `97210d5`, put spectral at 8.0%
and nbody at −3.5%. Alternating the two builds is meant to stop drift on the
machine from landing on one column only, and these rows replace that run.

**For S2's bar the outcome was undecided when S0 was written; §7 records how
`s2-cpu` read it.** The bar is ≥10% at one level on
at least one of nbody, vec3 or spectral, with no loss on the others. Per
benchmark:

- **spectral clears 10% in both alternating samples:** 10.7% on the minimum
  and 14.7% on the median in the first, and 21.3% and 14.8% in the second.
- **nbody does not lose.** It gained 4.1% and 0.2% in the first sample, and
  2.2% and 4.1% in the second.
- **vec3 shows a possible small loss, so "no loss on the others" is not
  clearly met.** It is at or below zero in three of its four figures: −0.3%
  on the median in the first sample, and −1.2% and −1.0% in the second. Only
  its minimum changes sign between the samples (+2.7%, then −1.2%). Its
  median is negative in both.

The bar gives no tolerance, and this note does not add one. Whether a vec3
change of −0.3% to −1.2% counts as a loss is the open question. The owner
answers it, or `s2-cpu` does by measuring vec3 at the level it would ship. It
is not settled here. What is settled is that a CPU level buys a real gain on
one of the three, as Rust's native column showed above, and next to nothing on
the other two.

#### S1: `std/json` on `indexOfAny`, the bar missed

S1's bar was `bench/json` with `jsonFields` from 75.7 ms to about 50. No way
of putting `indexOfAny` into `std/json` was reliably faster than S0, and none
came near 1.5x, so `std/json` is unchanged. The scan has nothing for
a search to jump: inside `bench/json`'s nested values a quote, brace or
bracket comes every 5 to 7 bytes, and the parts of the reader a byte search
could reach are about 37% of its instructions.

**How it was measured.** This row is S0 for S1 alone. It was taken at
`f33139a`, `main` after #507's stage 3 (#532), interleaved with the variants
on one machine as §7 requires: an `Intel(R) Xeon(R) Processor @ 2.80GHz` with
4 vCPUs, so not a ratio against the 2.1 GHz table above. The harness is
§2.3's, from branch `ccr-ee7596b7-up0cqq` at `956506d`, checked out and not
committed. At that commit it names an undefined variable when its input file
is missing, so the input was generated first and put where it looks. It times
`jsonField` ×3 only, so a second program timed `jsonFields` and #507's four
non-benchmark shapes. Each variant was built by the same compiler, and every
one printed S0's checksum on every shape. One warm-up preceded the rounds, and
S0 was also timed against a byte-identical copy of itself, which shows the
noise. In ms, minimum / median, with peak RSS for the whole process:

| Shape | S0 | S0 against its copy |
| --- | ---: | ---: |
| `bench/json`, `jsonFields` (9 rounds) | 75.7 / 77.7, 88.1 MB | +0.3% / +1.1% |
| `bench/json`, `jsonField` ×3, the harness's own program (15 rounds) | 79.9 / 84.7, 88.1 MB | +1.5% / −0.9% |
| a compiler `--json` line, `jsonFields` | 37.8 / 40.3, 42.2 MB | −1.4% / −3.9% |
| 50 keys, the field last, `jsonField` | 164.2 / 170.9, 346 MB | +1.2% / −1.8% |
| 50 keys, a miss, `jsonField` | 163.5 / 170.5, 346 MB | +2.8% / +2.1% |
| short strings only, the last key, `jsonField` | 81.8 / 88.4, 59.6 MB | −0.9% / −4.8% |

Across all twelve rows of the second program's run, both readers on every
shape, S0 and its copy differed by under 3% on most figures, by up to 6.1% on
a minimum (the `--json` line, `jsonField` ×3) and by up to 6.7% on a median
(`bench/json`, `jsonField` ×3). That is the band a variant's figure has to
leave before it says anything. The `--json` line is 100,000 lines drawn from 307
real `build/nish --json` diagnostics of `tests/cases/reject_*`, with the file,
line, column and code varied. The 50-key object has 49 string fields of 4 to
44 bytes, then the field. The short strings are 30 keys of one to three bytes,
each with a value of one to three bytes.

**Four variants.**

- **A**: the depth scan of a nested value jumps from each quote, brace or
  bracket to the next with `indexOfAny(text, "\"[]{}", i + 1)`.
- **B**: the same scan reads up to 8 bytes inline and calls `indexOfAny` only
  past them.
- **C**: `jsonClosingQuote` finds the next quote or backslash with
  `indexOfAny(text, "\"\\", i)`, in place of `indexOf` and a count of the
  backslashes before the quote.
- **D**: C with no inline window, so every string is searched from its first
  byte.

Instructions under callgrind, 20,000 lines, `jsonField`, the whole run:

| Variant | short strings | `--json` line | `bench/json` | 50 keys |
| --- | ---: | ---: | ---: | ---: |
| S0 | 179.7 M | 155.2 M | 222.4 M | 624.4 M |
| A | 179.7 M | 155.2 M | 260.4 M (+17%) | 624.4 M |
| B | 179.7 M | 155.2 M | 229.0 M (+3%) | 624.4 M |
| C | 176.2 M (−2%) | 157.6 M (+2%) | 231.6 M (+4%) | 645.0 M (+3%) |
| D | 279.0 M (+55%) | 167.7 M (+8%) | 251.9 M (+13%) | 596.7 M (−4%) |

On `bench/json`, against S0 in the same rounds, minimum / median (+ is
slower):

| Variant | `jsonFields` | `jsonField` ×3, the harness's program |
| --- | ---: | ---: |
| A | +12.0% / +10.9% | +18.9% / +18.5% |
| B | −2.8% / +1.0% | +7.3% / +5.0% |
| C | +7.5% / +10.9% | +12.8% / +9.3% |
| D | +12.5% / +12.3% | +15.3% / +12.7% |

Every figure of A, C and D is slower or inside the noise band: C's −0.2%
median with `jsonField` ×3 in the second program is inside it. B's −2.8% at
the minimum with `jsonFields` and −3.5% at the minimum with `jsonField` ×3 in
the second program are inside it too. Only one figure leaves the band, B's
−7.6% median with `jsonField` ×3 in the second program, by 0.9 points. It
comes from S0's own median in that row, 94.2 ms against its copy's 87.9 in the
same rounds. No variant is reliably faster, and none comes near the 33% that
1.5x means. In the harness's program the same change is 7.3% slower at the minimum and 5.0% at the median,
and in two runs of the harness's own report, not interleaved, 9.4% and 5.9%
slower at the minimum. Its `indexOfAny` is never called on these lines, so
what B changes is a real cost, the 8-byte window's 3% more instructions on
`bench/json`, plus where the code lands. That second part is visible on the
`--json` line: on 20,000 lines with `jsonFields`, B executes 30,268,909
branches to S0's 30,268,647, and cachegrind's simulated predictor counts
1,141,078 mispredicts to S0's 1,241,360, 8% fewer, which points to a change of
addresses rather than of work. On the three non-benchmark columns of the
callgrind table A and B execute what S0 does, and most of their figures on the
four shapes stay inside the band. Those outside it are A on the `--json` line
(−7.6% at the minimum, −9.5% and −6.9% at the median), on the 50-key object
with `jsonFields` (−7.2% and −6.3% at the minimum, −7.1% at the median) and on
short strings' last key with `jsonField` (−8.2% at the median), and B on the
`--json` line with `jsonFields` (−6.3% and −8.3%), on the 50-key miss (−6.8%
and −8.4% at the median) and one slower median, short strings' last key with
`jsonFields` (+6.8%): layout of the same kind, in both directions. D is 5.8% to
11.6% slower on the 50-key object, outside the band on all four of its medians,
so it fails the shapes' condition as well.

**Why.** Where S0's time goes, under callgrind, for `jsonFields` on 20,000
`bench/json` lines:

| Part of the timed loop | Instructions |
| --- | ---: |
| the member scan's string windows | about 35 M |
| the member scan's depth loop | about 12 M |
| the member scan's blank skip | about 4 M |
| the rest of the member scan, per member | about 27 M |
| key comparisons | 18 M |
| unescaping the values | 17 M |
| `jsonFields`' own loop | 15 M |
| the runtime and libc: copies, allocation, `memchr` | about 10 M |
| **total** | **about 138 M** |

A 1.5x gain takes about 46 M out of the 138 M. The three parts a byte search
could reach add up to 51 M, so even a free search leaves almost no margin, and
the rest is per-member and per-key work. Inside the nested `range` object and
`related` array, the bytes between one quote, brace or bracket and the next
are a colon, a number and a comma: 5 to 7 bytes, about 35 instructions as a
byte loop. A made 379,280 `indexOfAny` calls on 20,000 lines, about 19 a line,
at about 116 instructions each. About 7 of those are `std/text`'s checks and
clamp, which mostly fold away for a constant set. About 106 are this kernel's
AVX2 path, which splats the set into registers on every call and compares a
block against each byte of the set in a loop; that is a cost of how the kernel
is written, and a kernel specialised to a fixed set would pay less. Even so,
the depth loop it would replace is about 12 M in all, and a search that cost
nothing there would take a quarter of the 46 M. The strings already skip their
bodies with `memchr` past 16 inline bytes (#532), and C and D show that
`indexOfAny`'s call costs more than `memchr`'s and stops at every backslash.
The blank skip cannot use it at all: `indexOfAny` finds the first byte *in* a
set, and a blank skip wants the first byte that is not.

Importing `nish/text` into `std/json` would cost a program no names, because
`std/` modules share package `nish`'s namespace and not the importer's
([std/README.md](../std/README.md)). It would cost every program that imports
`nish/json` a compile of `nish/text` and the
[vector unit](wp7-runtime.md#the-vector-unit) in its link. The harness's
binary grew from 16,712 to 19,648 bytes with A.

#### S5: AES-GCM, the baseline

S5 puts AES-GCM on AES-NI and PCLMULQDQ (and ARMv8's AES and PMULL) as a
runtime kernel, as §3.1 describes and §3.3 asks. This is its baseline, taken
before anything is built: `std/crypto/aes.ts` as it is, bitsliced, with
ChaCha20-Poly1305 beside it for scale.

**How it was measured.** `node bench/aes-gcm.mjs --self --runs 15`, twice, on
`ce9d394` (`main`; the branch adds only this note and the bench files), with
`build/nish` built from that commit by the 0.18.0 seed. The machine was an
`Intel(R) Xeon(R) Processor @ 2.80GHz` (lscpu: family 6, model 85; 4 vCPUs
under KVM; AES-NI, PCLMULQDQ and AVX2 present, no VAES), Ubuntu clang 18.1.3.
`bench/aes-gcm.ts` times each workload alone in its process, and every input
changes on every iteration: seal stamps the iteration into the IV's first word
and the plaintext's first word, open cycles through sixteen messages sealed
before its clock starts, and the mask stamps its sample. Every answer is
folded into a printed checksum, which every run must repeat. The 16 KiB
workloads handle 4 MiB each (256 records), the 1,200-byte ones 4.2 MB (3,496
packets), and the mask 65,536 samples. MB/s is 10^6 bytes a second. There is
no `perf` on this machine, so cycles per byte is the time multiplied by the
nominal 2.8 GHz and divided by the bytes: a derived figure, not a counted one.
Each column ran sixteen timed rounds after one warm-up, alternating with a
byte-identical copy of itself. From the first sample:

| Workload | min ms | median ms | MB/s at min | MB/s at median | cycles/B at min | at median |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| AES-128-GCM seal, 16 KiB | 76.04 | 83.31 | 55.2 | 50.3 | 50.8 | 55.6 |
| AES-128-GCM open, 16 KiB | 72.86 | 80.52 | 57.6 | 52.1 | 48.6 | 53.8 |
| AES-128-GCM seal, 1,200 B | 76.59 | 82.07 | 54.8 | 51.1 | 51.1 | 54.8 |
| AES-128-GCM open, 1,200 B | 76.45 | 81.77 | 54.9 | 51.3 | 51.0 | 54.6 |
| ChaCha20-Poly1305 seal, 16 KiB | 19.07 | 21.61 | 220.0 | 194.1 | 12.7 | 14.4 |
| ChaCha20-Poly1305 open, 16 KiB | 19.06 | 21.10 | 220.0 | 198.8 | 12.7 | 14.1 |
| ChaCha20-Poly1305 seal, 1,200 B | 20.24 | 21.24 | 207.3 | 197.5 | 13.5 | 14.2 |
| ChaCha20-Poly1305 open, 1,200 B | 20.26 | 21.38 | 207.0 | 196.2 | 13.5 | 14.3 |
| `aesHeaderMask`, 65,536 samples | 45.99 | 48.68 | 22.8 | 21.5 | 122.8 | 130.0 |

So AES-128-GCM runs at about 55 MB/s, a quarter of ChaCha20-Poly1305's
speed. One header mask costs about 702 ns, about 2,000 cycles, because the
bitsliced cipher always encrypts a batch of four blocks, and the mask needs
one.

**The noise band.** Here is the baseline against its own copy, minimum /
median, in both samples. + means the copy was slower:

| Workload | first sample | second sample |
| --- | ---: | ---: |
| AES seal, 16 KiB | −1.2% / +2.0% | −0.2% / +10.6% |
| AES open, 16 KiB | +3.0% / −2.4% | +0.1% / +11.1% |
| AES seal, 1,200 B | +0.7% / +0.7% | −0.1% / +1.0% |
| AES open, 1,200 B | +1.5% / +4.8% | −2.1% / −2.0% |
| ChaCha seal, 16 KiB | −0.2% / −7.8% | +0.1% / −3.9% |
| ChaCha open, 16 KiB | +1.4% / −2.9% | +1.0% / −0.3% |
| ChaCha seal, 1,200 B | +0.9% / −0.4% | −0.1% / +1.4% |
| ChaCha open, 1,200 B | +0.5% / +4.7% | +1.0% / +1.0% |
| `aesHeaderMask` | −0.2% / +1.7% | +0.8% / +0.7% |

A binary differs from itself by up to 3.0% at the minimum and 11.1% at the
median on this machine. A later figure has to leave that band before it says
anything. The minima are the steadier statistic here.

**One real exchange.** The server was `tests/link/net_interop_server`, built
as `tests/interop/server.dockerfile` builds it, plus `-g` so that the profile
can name functions. It served a 1 MiB random file with `serve --www <dir>`
under `valgrind --tool=callgrind`, since `perf` is not installed. Its
counters were zeroed once it had printed its ports, so minting its identity
is left out. Each dump then covers one `curl --http2 -k` GET of the file,
handshake included. The client was curl 8.5.0 with OpenSSL 3.0.13. Unforced,
it negotiated **TLS_AES_256_GCM_SHA384**, the first suite in OpenSSL's
default TLS 1.3 list. Each suite was also forced with `--tls13-ciphers`. The
figures are the server's instructions (Ir), not its cycles:

| Suite | All | the AEAD's module | `TlsRecordProtection.seal` | `http2FrameWritePadded` | P-256 and X25519 |
| --- | ---: | ---: | ---: | ---: | ---: |
| TLS_AES_256_GCM_SHA384 (curl's choice) | 321.5 M | 259.5 M (80.7%) | 28.4 M (8.8%) | 17.8 M (5.5%) | 12.6 M (3.9%) |
| TLS_AES_128_GCM_SHA256 | 272.9 M | 210.9 M (77.3%) | 28.4 M (10.4%) | 17.8 M (6.5%) | 12.6 M (4.6%) |
| TLS_CHACHA20_POLY1305_SHA256 | 113.0 M | 51.0 M (45.1%) | 28.4 M (25.2%) | 17.8 M (15.8%) | 12.6 M (11.2%) |

Under AES-128-GCM, `std/crypto/aes.ts` divides like this. GHASH's
`ghashMultiply` is 48.6 M (17.8% of the server). The bitsliced cipher is
`aesShiftRows` 38.4 M, `aesSbox` 38.1 M, `aesEncryptBatch` 37.3 M,
`aesAddRoundKey` 10.8 M, and `aesTranspose` and `aesPack` 6.9 M. Then come
`aesLoad64` at 15.4 M and `aesGcmCtr` at 13.5 M. The server built without
`-g`, timed natively from `/proc/<pid>/stat` over ten transfers per suite,
used 30 ms of CPU per transfer with AES-128-GCM, 35 ms with AES-256-GCM, and
15 ms with ChaCha20-Poly1305. That is at the clock tick's 10 ms resolution,
which is 1 ms a transfer over ten.

So AES is on the real path. Most of the server's work on a TLS transfer is
AES whenever the client lists an AES suite first. curl does, with AES-256.
Chrome would too: `chooseSuite` (`std/net/tls.ts`) takes the client's first
suite this module negotiates, and BoringSSL lists AES-128-GCM first on a CPU
with AES instructions. ChaCha20-Poly1305 comes first only on a CPU without
them. That ordering is BoringSSL's rule; it was not measured here. QUIC
Initial packets are AES-128-GCM whatever the suite, and so is their header
protection (RFC 9001 §5). So S5's stop rule does not apply. That rule ends
the stage at this measurement, with nothing built, if real clients do not
negotiate AES or AES is a negligible share of the server's CPU. The kernel
has to serve both key sizes, since curl's default is AES-256.

**The bar, set before anything is built.** AES-128-GCM seal on 16 KiB is at
least **5x faster** on x86-64 with AES-NI, measured on this machine, or on
another one after the baseline is re-run there. That is a minimum at or under
15.208 ms for the 4 MiB (76.04 ms / 5), which is 275.8 MB/s or more. And the fallback path, the
bitsliced code a machine without the instructions runs (and
`NISH_AES=soft`), is not slower than this baseline outside the noise band:
3.0% at the minimum and 11.1% at the median, on each of the nine workloads.

#### S5: AES-GCM, the result

**Bar met.** The kernel is `runtime/runtime-aes.c` (#594), on the four seams
#592 cut in `std/crypto/aes.ts`; the compiler calls it behind a branch on
`nish_aes_hw` (`src/kernels.ts`), keeping the bitsliced walker called on the
other arm. Measured at `0db1292` with `build/nish` built from it by the 0.18.0
seed, on an `Intel(R) Xeon(R) Processor @ 2.10GHz` (lscpu: family 6, model
207; 4 vCPUs under KVM; AES-NI, PCLMULQDQ, VAES and AVX-512 present; the
kernels use AES-NI, PCLMULQDQ and SSSE3 only), Ubuntu clang 18.1.3. That is
not the machine the baseline above was taken on, so the baseline was re-run
here, as the bar allows: `bench/aes-gcm.ts` built by `main`'s compiler
(`ea34c4e`, the bitsliced code with #592's seams), timed in the same
interleaved rounds as the kernel. Cycles per byte are again derived, at the
nominal 2.1 GHz.

`node bench/aes-gcm.mjs --self --binary <main's build> --env NISH_AES=soft
--runs 16`: sixteen rounds of four columns after one warm-up. Every run
printed the same checksum, 1163276789.

| Workload | kernel min / median ms | MB/s | main's build min / median ms | MB/s | faster, min / median |
| --- | ---: | ---: | ---: | ---: | ---: |
| AES-128-GCM seal, 16 KiB | 1.11 / 1.37 | 3,765.0 / 3,058.4 | 42.76 / 45.37 | 98.1 / 92.4 | **38.5x** / 33.1x |
| AES-128-GCM open, 16 KiB | 1.08 / 1.35 | 3,885.8 / 3,099.0 | 42.58 / 45.44 | 98.5 / 92.3 | 39.4x / 33.7x |
| AES-128-GCM seal, 1,200 B | 1.42 / 1.83 | 2,950.4 / 2,287.2 | 41.47 / 47.32 | 101.2 / 88.7 | 29.2x / 25.9x |
| AES-128-GCM open, 1,200 B | 1.59 / 1.82 | 2,642.2 / 2,309.4 | 42.65 / 47.48 | 98.4 / 88.4 | 26.8x / 26.1x |
| `aesHeaderMask`, 65,536 samples | 0.72 / 0.91 | 1,460.8 / 1,157.4 | 26.90 / 27.99 | 39.0 / 37.5 | 37.4x / 30.8x |

The kernel's own copy, in the same rounds, stayed within 14.1% of it at the
minimum and 2.1% at the median, so every ratio is far outside the band. Seal
on 16 KiB costs 0.5 to 0.7 derived cycles a byte; one header
mask costs 11 to 14 ns, where the bitsliced cipher's batch of four blocks
cost about 410. The ChaCha20-Poly1305 rows are unchanged code and are left
out.

**The fallback.** `NISH_AES=soft node bench/aes-gcm.mjs --compiler <main's
nish> --self --binary <this build> --runs 18`, again with `--runs 24`, and a
third time with `--runs 48` at `493384d` on an otherwise idle machine: the
baseline is `main`'s build, its byte-identical copy gives the band, and this
build runs the bitsliced arm of every branch. A fourth sample, against
`ce9d394` itself on a quieter host, follows these three and meets the bar at
the minimum too. + is slower than `main`:

| Workload | sample 1: soft, min / median | band | sample 2: soft | band | sample 3: soft | band |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| AES seal, 16 KiB | −23.3% / −0.2% | −19.8% / +0.4% | −6.7% / −0.3% | −20.1% / +1.1% | −9.0% / +0.9% | −11.9% / +0.5% |
| AES open, 16 KiB | −0.1% / +1.4% | −17.1% / −0.4% | −7.8% / −5.6% | −21.9% / −0.8% | −15.4% / +0.2% | −1.8% / +0.7% |
| AES seal, 1,200 B | +7.0% / −0.4% | −10.7% / −1.0% | −13.8% / −3.9% | −20.1% / −1.4% | −17.8% / −0.0% | −1.6% / +0.5% |
| AES open, 1,200 B | +0.7% / −0.2% | −14.0% / −1.2% | −17.9% / +1.3% | −9.2% / −1.0% | −15.4% / −0.9% | +2.0% / −0.5% |
| ChaCha seal, 16 KiB | +8.3% / −0.0% | −5.6% / −2.4% | −8.0% / +2.5% | −4.7% / −1.4% | −11.7% / +0.2% | −0.0% / +0.2% |
| ChaCha open, 16 KiB | +9.2% / +5.2% | +5.4% / +2.5% | −19.1% / +1.7% | −5.7% / −2.4% | −14.8% / −0.2% | −0.5% / +0.7% |
| ChaCha seal, 1,200 B | +30.2% / +3.6% | +27.5% / +2.0% | −7.1% / +0.9% | −4.4% / −0.7% | −12.1% / +0.4% | +0.6% / +0.3% |
| ChaCha open, 1,200 B | +13.9% / +1.8% | +12.2% / −0.6% | −9.1% / +0.1% | −6.9% / −0.5% | −13.8% / +0.2% | −1.0% / +1.0% |
| `aesHeaderMask` | +10.9% / −0.7% | +6.6% / +0.0% | +15.5% / −2.5% | +18.7% / −2.0% | −14.1% / −2.4% | −3.7% / −0.9% |

Read against the bar as it was set, 3.0% at the minimum and 11.1% at the
median:

- **At the median the fallback meets it** on all nine workloads in all three
  samples. The worst AES figure is +1.4%, and the worst of all is
  ChaCha20-Poly1305's +5.2%, code this change does not touch.
- **At the minimum the pre-registered band does not hold on this machine.**
  A binary's minimum moved by up to 27.5% against its own byte-identical copy,
  so a 3.0% band at the minimum measures the machine and not the change. Read
  instead against the copy in the same rounds, every AES workload's fallback
  minimum is within the copy's own spread. Two ChaCha20-Poly1305 minima in the
  first sample, code this change does not touch, sit just past it: seal on
  1,200 B at +30.2% against the copy's +27.5%, and open on 16 KiB at +9.2%
  against +5.4%; both are faster than `main` in the second and third samples.
  `aesHeaderMask`'s minimum, +10.9% and +15.5% in
  the first two samples, is −14.1% in the third, the longest, run on an idle
  machine. The arm adds one `nish_aes_hw` call, a compare and a branch to each
  single-block encrypt. That is a few nanoseconds against the ~410 ns the
  bitsliced batch costs, under 2%, so it cannot account for a 10% minimum; the
  first two minima were the machine's scatter.

So the fallback is not slower than `main`: at the median within the
pre-registered band on all nine workloads, and at the minimum, on every AES
workload, within the noise this machine shows.

**Against `ce9d394` itself, a fourth sample.** The three samples above read
the fallback against `main`'s build, not against the commit the bar names. The
fourth reads it against `ce9d394`. `bench/aes-gcm.ts` came after `ce9d394`, so
`main`'s copy of it (byte-identical at `b515c1b`) was built in a `ce9d394`
worktree against that commit's own `std/` and `build/nish`, which the 0.18.0
seed from its `scripts/fetch-seed.sh --force` bootstrapped. It was built with
`--profile speed`, as `bench/aes-gcm.mjs` builds its baseline, and printed
`--check`'s pinned checksum, 2203470130. Then, on `main`'s build at
`b515c1b`:

`NISH_AES=soft node bench/aes-gcm.mjs --self --binary <ce9d394 build> --runs 48`

That is 48 rounds of three columns after one warm-up. Every run printed the
same checksum, 1163276789. The host was the same model as the kernel's above
(family 6, model 207; `nproc` 4 under KVM; Ubuntu clang 18.1.3), with AES-NI
present, which `soft` does not use. The machine was otherwise idle. The load
average was 0.87, 0.49, 0.20 before the run (the tail of `main`'s build had
just finished) and 0.94, 0.56, 0.24 after. The bench prints `ce9d394` against
the fallback; the table reads it the other way, so + means the fallback was
slower than `ce9d394`:

| Workload | soft min / median ms | `ce9d394` min / median ms | soft against `ce9d394`, min / median | band (copy), min / median |
| --- | ---: | ---: | ---: | ---: |
| AES seal, 16 KiB | 34.38 / 45.46 | 35.99 / 47.79 | −4.5% / −4.9% | −0.2% / +3.1% |
| AES open, 16 KiB | 34.26 / 45.87 | 36.07 / 48.14 | −5.0% / −4.7% | +0.2% / +0.3% |
| AES seal, 1,200 B | 36.02 / 47.81 | 37.76 / 50.26 | −4.6% / −4.9% | +0.3% / +0.1% |
| AES open, 1,200 B | 36.68 / 47.86 | 38.03 / 49.56 | −3.5% / −3.4% | −1.4% / +0.9% |
| ChaCha seal, 16 KiB | 10.19 / 13.75 | 10.82 / 14.04 | −5.8% / −2.1% | +0.5% / −2.1% |
| ChaCha open, 16 KiB | 10.22 / 13.52 | 10.75 / 14.05 | −4.9% / −3.8% | +1.0% / +0.3% |
| ChaCha seal, 1,200 B | 11.10 / 14.58 | 11.66 / 15.04 | −4.8% / −3.1% | +1.2% / −0.8% |
| ChaCha open, 1,200 B | 11.22 / 14.60 | 11.61 / 15.04 | −3.4% / −2.9% | +0.3% / −0.3% |
| `aesHeaderMask` | 21.47 / 28.19 | 21.29 / 27.63 | +0.8% / +2.0% | −0.2% / −0.3% |

On this run the byte-identical copy stayed within
1.4% of the baseline at the minimum and 3.1% at the median. So the 3.0% band
measures the change here, not the machine. Against it:

- **At the minimum the fallback meets the pre-registered bar** on all nine
  workloads. Eight are faster than `ce9d394`. The ChaCha20-Poly1305 rows,
  code the change does not touch, are faster by as much as the AES rows,
  so that gain comes from what else moved between `ce9d394` and `b515c1b`,
  not from the fallback. `aesHeaderMask` is +0.8%, inside 3.0%.
- **At the median the bar holds too**: the worst figure is `aesHeaderMask`'s
  +2.0% against 11.1%.

So, against `ce9d394` on a host whose noise stays inside the band, the
fallback is not slower than S5's baseline at the minimum or the median on any
of the nine workloads: the pre-registered bar holds as written.

**What the bar does not settle.** It is a raw comparison with `ce9d394`, and
between `ce9d394` and `b515c1b` the comparator itself moved: the ChaCha20-Poly1305
rows, which the change does not touch, ran 3.4% to 5.8% faster at the minimum
and 2.1% to 3.8% at the median. The four bulk AES rows moved by the same
amount, so on them the fallback's own cost reads as near zero either way.
`aesHeaderMask` did not: it is the workload that isolates the single-block
encrypt, where the arm adds its call and branch, and it is the one row that
went slower. If the same drift applied to it, the fallback's own cost there
would be about 4% to 7% at the minimum, above the 3.0% band, and 4% to 6% at
the median, inside 11.1%. That is above the under-2% estimated for the arm
above. Nothing here shows the drift does apply to a single-block workload, so
this sample leaves the drift-corrected minimum open rather than failing it.
Settling it takes a comparator with the drift removed: `b515c1b` with the arm
taken out, timed against the fallback in the same interleaved rounds.

#### S3a: the bar kernels without a surface

S3's bar (§7) asks whether a kernel written with `nish:simd` is at least 1.5x
faster than the same kernel in fair scalar Nish (§3.2.1), on a numeric
program from `bench/` and on `bench/scan.ts`'s depth counting. S3a answers
that question before any surface exists. It writes each kernel in C's portable
`vector_size(16)` vectors, which lower to the same LLVM vector IR `nish:simd`
would emit, and times that against scalar Nish.
[`bench/simd-s3a.mjs`](../bench/simd-s3a.mjs) builds and times four forms of each
kernel from [`bench/simd-s3a/`](../bench/simd-s3a/):

1. **C vector**, the stand-in for `nish:simd`: `clang -O3 -ffp-contract=off`,
   no `-march`, so x86-64's baseline SSE2.
2. **C scalar**, the same build, written the way the scalar Nish forms are.
3. **Nish checked**: `nish --link --profile speed`, with checked indexing and
   the guards #561 needs to prove each access.
4. **Nish unchecked**: the same, through `uncheckedGet`.

The scalar forms do the vector form's work. Their integer arithmetic wraps
(`wrappingAdd`) where the lanes do, and they keep one accumulator for every
lane, so every form adds in the same order and prints one checksum. The
harness refuses to time a row whose forms disagree. It also refuses a vector
form whose source includes a target intrinsic header or calls a
`__builtin_ia32_`, `__builtin_neon_` or `__builtin_aarch64_` builtin, or whose
`clang -O2` IR calls an `llvm.x86.` or `llvm.aarch64.` intrinsic. Two probes
check that refusal on every run. One is an x86-64 `_mm_sad_epu8`, which lowers
to `llvm.x86.sse2.psad.bw`. The other is an AArch64 `vqtbl1q_u8`, which lowers
to `llvm.aarch64.neon.tbl1` and is compiled with `--target=aarch64-linux-gnu
-ffreestanding`.

The kernels:

- **mat-vec** is the spectral-norm matrix-vector product: `N = 2000`, 100
  rounds, adapted from `bench/spectral.ts`. The vector form computes four
  `i32` indices per step in one `i32x4` and keeps two `f64x2` accumulators.
  The scalar forms keep four `f64` accumulators and compute their indices
  with `wrappingAdd`.
- **depth** is `bench/scan.ts`'s depth counting over a 1 MiB document, 500
  rounds. Each round rewrites one bracket pair, so no round's answer can be
  hoisted. A row is one document. **s0** repeats S0's piece, dense in
  structure. **log** repeats a log-shaped record whose long message holds
  no structural byte. The scalar forms run S0's byte-at-a-time state
  machine. The vector form classifies 16 bytes at once (`"`, `\`, and `{`,
  `}`, `[`, `]` by OR-ing `0x20`). It skips a block in which none of them
  occurs, and otherwise walks the hit mask with `ctz`. That mask is one
operation beyond element-wise arithmetic: the block's `<16 x i1>` compare
result is turned into a 16-bit integer (a bool vector, `ext_vector_type(16)`,
copied into a `uint16_t`, which is a portable `bitcast <16 x i1> to i16` in
the IR). `nish:simd` would need that bitmask as an operation of its own.

Taken at `46a1e4d`, this PR's kernels-and-harness commit; the kernels have not
changed since. The machine was a KVM container on an `Intel(R) Xeon(R)
Processor @ 2.80GHz` (lscpu: family 6, model 85; 4 vCPUs; SSE4.2, AVX2 and
AVX-512F present, none of them used, since no `-march` is given), running
Ubuntu 24.04.5 LTS with Ubuntu clang 18.1.3. The command was `node bench/simd-s3a.mjs --self
--runs 15`: 15 rotating rounds of 5 after one warm-up. `--self` adds a
byte-identical copy of form 3, timed in the same rounds, and its ratio to
form 3 is the noise band. No AArch64 machine was at hand, so **there is no
AArch64 figure**. The AArch64 side was checked only for portability, by
cross-compiling the vector forms' IR, which calls no `llvm.aarch64.`
intrinsic.

| mat-vec (checksum 901781) | min | median |
|---|---:|---:|
| 1 C vector | 381.4 ms | 447.0 ms |
| 2 C scalar | 486.0 ms | 558.3 ms |
| 3 Nish checked | 671.7 ms | 737.8 ms |
| 4 Nish unchecked | 652.5 ms | 747.4 ms |
| 3 Nish checked, copy | 659.3 ms | 717.6 ms |

| depth, s0 (checksum 680640) | min | median |
|---|---:|---:|
| 1 C vector | 397.0 ms | 442.0 ms |
| 2 C scalar | 706.1 ms | 813.7 ms |
| 3 Nish checked | 753.4 ms | 800.0 ms |
| 4 Nish unchecked | 745.5 ms | 804.3 ms |
| 3 Nish checked, copy | 724.3 ms | 822.3 ms |

| depth, log (checksum 176206) | min | median |
|---|---:|---:|
| 1 C vector | 133.6 ms | 172.9 ms |
| 2 C scalar | 667.6 ms | 749.2 ms |
| 3 Nish checked | 531.7 ms | 606.7 ms |
| 4 Nish unchecked | 530.9 ms | 615.1 ms |
| 3 Nish checked, copy | 522.4 ms | 634.2 ms |

Building the depth document without scanning it costs 5.4 ms in C and 5.9 ms
in Nish, about 1% of the smallest Nish row, so it is left in the figures.

| Ratio, min / median | mat-vec | depth s0 | depth log |
|---|---:|---:|---:|
| **1 over 3** (the bar) | **1.76x / 1.65x** | **1.90x / 1.81x** | **3.98x / 3.51x** |
| 1 over 4 | 1.71x / 1.67x | 1.88x / 1.82x | 3.97x / 3.56x |
| 1 over 2 | 1.27x / 1.25x | 1.78x / 1.84x | 5.00x / 4.33x |
| 3 over its copy (the band) | 0.98x / 0.97x | 0.96x / 1.03x | 0.98x / 1.05x |

The band is within 5% on every row. Every ratio of form 1 over form 3 is at
least 1.65x, far outside it.

**Whether the scalar forms vectorised.** Clang reported this with
`-Rpass=loop-vectorize` and `-Rpass=slp-vectorizer` at `-O3`. The Nish forms
were emitted with `nish -g` first, so each remark names a source line. The
plan's way was to grep `opt -O3`'s output for `<2 x double>` in the kernel's
body. That does not work here, because at `-O3` the kernel is inlined into
`nish_main` and no kernel body is left to grep.

- **mat-vec: yes, all three scalar forms.**
  - The SLP vectoriser packs the four accumulators into `<2 x double>` pairs.
    The remark points at the line that sums them (`av[i] = s0 + s2 + (s1 +
    s3)`).
  - The inner loop runs without a bounds check, which is #561's guard at work.
    That is why forms 3 and 4 time the same.
  - The one `loop-vectorize` remark in each form is the driver's
    initialisation loop, not the kernel.
  - What form 1 keeps over them is its index arithmetic. It computes four
    `i32` indices per `i32x4` operation, while the scalar forms compute two
    per `<2 x i32>`.
- **depth: no loop vectorised** in forms 2, 3 or 4. The state machine
  carries the depth, the string state and the escape across every byte.
  Nish's form 3 is faster than the C scalar form on log (531.7 against
  667.6 ms). That is a property of the two builds' code layout, not of the
  bar, which compares against form 3.

**The reading.** Both kernels clear 1.5x at the default target. mat-vec
clears it by 1.65x at the median, even though scalar Nish already vectorises
the loop. The byte scan clears it by 1.81x on a dense document and 3.51x on
a sparse one. Against C scalar (form 2), mat-vec's vector form is only
1.27x / 1.25x faster. Its 1.65x over form 3 is partly a gap of about 1.3x
between scalar Nish and scalar C on the same loop, which this stage does not
diagnose. Both are SLP-vectorised to `<2 x double>`. The bar compares against
form 3 as written, so the verdict stands. The depth kernels clear 1.5x
against form 2 too. By the order decided in §7 (2026-10-16), **S3's design is
written next**. That design still has to settle how much of the byte half S6c's
classifier already covers (§2.4). The figures are x86-64's only.

### 2.4 `JsonTokenizer` after json-parity: the gap S6 is aimed at

`std/json`'s reader, which S1 measured, is no longer where the JSON gap is.
The json-parity run (#597) moved the work to `nish/json-tokenizer`,
`nish/json-value` and `nish/json-typed`, and measured them against simdjson,
yyjson, RapidJSON, serde_json and Go with `bench/json-compare`. The figures
below are the record at `06645ecf` ([BENCHMARKS.md](BENCHMARKS.md), the
json-compare section, #632). Each is Nish's minimum ns per document; each
factor is that minimum over the comparator's, so 2.00x means the comparator
is twice as fast. The noise band is Nish against a byte-identical copy of
itself in the same rounds.

| Workload | Nish min ns/doc | simdjson | yyjson | serde_json | RapidJSON | band |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| tokenize twitter.json (631,514 bytes) | 1,247,246 | 2.35x | 3.14x | 1.08x | 0.94x | 0.9% |
| tokenize citm_catalog.json (1,727,204 bytes) | 2,397,781 | 1.84x | 2.20x | 1.25x | 1.19x | 2.5% |
| tokenize canada.json (2,251,051 bytes) | 21,986,700 | 3.83x | 6.25x | 3.29x | 2.22x | 6.9% |
| typed, citm_catalog.json | 3,164,937 | 3.63x | — | 1.43x | — | 0.1% |
| serialize, citm_catalog.json | 870,432 | 2.54x | — | 2.12x | — | 1.1% |

None of these paths uses a vector. `JsonTokenizer`'s three run loops,
`jsonTokSkipBlank`, `jsonTokSkipDigits` and `jsonTokSkipPlain`
(`std/json-tokenizer.ts`), read one byte at a time; #614 took the
bounds-checked call out of each byte but kept the loop scalar, and LLVM does
not vectorise a loop that can stop at any byte. `indexOfAny` cannot stand in
for them as it is. It searches a `string`, and the tokenizer reads a `u8[]`.
It finds the first byte *in* a set of at most 16, and the tokenizer wants the
first byte *outside* a class: a string body runs until `"`, `\`, any of the 32
control bytes or a byte of 128 or more, 162 bytes in all. And S1 measured its
call at about 116 instructions, most of it splatting the set on every call
([§2.3](#s1-stdjson-on-indexofany-the-bar-missed)).

Two more things sit behind the factors, and neither is a vector:

- **canada.json is numbers.** At this record `numberF64` took Clinger's fast
  path for at most 15 significant digits and a decimal exponent within ±22,
  and called `parseFloat`, which is glibc's `strtod`, for every other number.
  canada's numbers have 16 to 17 significant digits, so every one took
  `strtod`, and #614 measured it at about 56% of canada's tokenize time; the
  rest alone would run at about 150 MB/s. yyjson and simdjson read such
  numbers with Eisel–Lemire, which needs a 64×64→128-bit multiply and a table
  of 128-bit powers of five. S6b has since put it in `numberF64` (§6, *S6b*).
- **The typed row flatters simdjson.** Its On-Demand reader decodes only
  `performances` and skips the rest of the document (the row says so), while
  Nish's typed decode reads the whole document through the tokenizer. The
  fair comparison is serde_json's 1.43x; simdjson's 3.63x bounds what a
  structural index could buy.

---

## 3. The options

Every option is judged on the same eight questions: cost, what it buys, what
it withdraws, the TypeScript reading, Node, wasm and N-API, constant-time
code, and the rolling freeze. The table is the summary; the subsections give
the reasons.

| | (a) Runtime kernels | (b) `nish:simd` types | (c) Target intrinsics | (d) Auto-vectorisation and `-march` |
| --- | --- | --- | --- | --- |
| Cost | S–M per kernel; a new runtime unit and its ceiling | L: a type family, the checker, emitter, `nish.mjs` | L, and again for every ISA | S for a flag; ongoing for loop shapes |
| Buys | the byte scans of §2.2 | hand-written numeric and byte kernels | everything, on one ISA | ~10% on some float kernels (§2.3) |
| Withdraws on 0.x | nothing | nothing (a new module) | nothing at first; a promise per ISA after | nothing as a flag; the default is not moved |
| TS reading | A: the `std` loop | A, if integer lanes wrap by name | D, or an emulator | A: no source change |
| wasm | the scalar loop, or simd128 | simd128, or scalarised by LLVM | none | `-msimd128` as the wasm level |
| CT checker | outside `expose` unless listed | inside the baseline it reads | outside it (CT-16) | outside it, at any level above the baseline |
| Freeze | `src/` from the next release | `src/` from the next release | — | none |

### 3.1 (a) Runtime kernels, chosen at run time

**What.** These are C functions in the style of `nish_str_index_of`, in a new
translation unit, `runtime/runtime-simd.c` (the name is open). They cannot go
in `runtime/runtime.c`: its ceiling is 3,606 bytes and it measures 3,606
([wp7-runtime.md](wp7-runtime.md#runtime-additions-and-budget)), and wp7's
rule is that a new surface gets its own unit and its own ceiling rather than
borrowing room. Two candidates:

1. **Find the first byte from a small set**, starting at an offset. For JSON
   the set is a quote and a backslash, or the structural bytes. For the lexer
   it is the end of a comment or a string. This is what `memchr` does for one
   byte. It is written once with SSE2 or NEON, which every 64-bit target has,
   so it needs no dispatch at all.
2. **Classify a block.** This gives a 64-bit mask with one bit per byte that
   belongs to a set, which is simdjson's first stage. It is only built if (1)
   misses its bar (§7), which it did. For JSON it answers several masks per
   64-byte block: quotes, backslashes, and the bytes `{}[]:,`. The escaped
   quotes and the bytes inside strings come out of those masks with
   simdjson's bit arithmetic, and a reader walks the set bits with a count of
   trailing zeros, so a structural byte costs a few instructions instead of a
   call.

A wider path (AVX2) is compiled with `__attribute__((target("avx2")))` and
chosen lazily, per kernel, on that kernel's first call. Each kernel is called
through a pointer that starts at a resolver. The resolver asks the CPU
directly, with `cpuid` and `xgetbv`, stores the path it picks and calls it.
It does not use `__builtin_cpu_supports`: that links libgcc's
`__cpu_indicator_init` constructor into every program, which #518 measured
taking `examples/hello.ts` from 4,712 bytes to 10,000 and its run 374
instructions longer (`runtime/runtime-simd.c`,
[wp7-runtime.md](wp7-runtime.md#the-vector-unit)). A later call goes straight to the stored path. Nothing
runs when the program starts, so a program that never calls a kernel pays
nothing, in time or in instructions, and `bench/instructions.json` cannot
move for it. glibc's `memchr` and simdjson also choose their paths at run
time. The binary stays a baseline binary.

**How a program reaches it.** Through a `std/text` function. Its working name
is `indexOfAny(text, bytes, from)`, and the name is open. The function checks
its arguments and clamps `from`, then hands the walk itself to one inner
function, the plain Nish loop over the bytes. The compiler recognises the
exported function by module and name, replaces that one inner call with the
kernel, and emits the rest of the body as written. So the argument checks and
the answer at the edges are the `std` file's, whichever way the program is
compiled. This is `std/threads.ts`'s mechanism. There the compiler replaces
the one call that walks the range (`mapRange` in a map, `reduceBlocks` in a
reduce) with the parallel region (`src/emit-parallel.ts`), and the length
check and combine order stay as written
([wp29](wp29-thread-surface.md) §4.1).

**TypeScript reading: class A.** Under Node the loop is the function, so
nothing needs translating and `runtime/nish.mjs` gains nothing. A golden pins
that the native and Node answers agree, as every builtin's does.

**wasm and N-API.** `--profile wasi` compiles the runtime units against wasi-libc.
The kernel there keeps a portable scalar fallback, or gets a `wasm_simd128.h`
path under `-msimd128` (§5). `runtime-wasm.c` has no strings, so freestanding
wasm has nothing to call it with. An N-API addon is built with the speed
flags, so it gets the native kernel unchanged.

**Cost.** The new unit costs what each of its siblings did:
- a ceiling constant in `tests/runtime-budgets.js`, set at the next 256-byte boundary
  above its first measurement, with a row in wp7's budget table and in
  MASTER_PLAN §2's table of units. The AVX2 path and the resolver count
  against that ceiling.
- its place in `scripts/build.sh`'s list of the units that `runtime.c`
  brings with it, for every profile that links strings, wasi included. The
  compiler's `--link` hands `scripts/build.sh` only `runtime/runtime.c`
  (`src/compile.ts`), so the pairing there is the one link change.
- tests that run the scalar, SSE2 or NEON, and AVX2 paths on the same inputs.

`-ffunction-sections -Wl,--gc-sections` drops it from a program that does not
call it, as it does for the other units. The instruction gate pins glibc to its SSE2 routines
(`PINNED_LIBC` in `bench/run.mjs`, [bench/README.md](../bench/README.md)), so
the runtime's own choice of path needs a way to be pinned too, such as an
environment variable the resolver reads. Otherwise a counted program's count depends
on the host.

**What it withdraws.** Nothing. It adds a `std` function, and every existing
program's IR is unchanged.

**What it does not buy.** Numeric code, and any scan whose step is not "find
the next byte from this set".

### 3.2 (b) `nish:simd`, fixed-width portable vectors

**What.** A builtin module with these types: `u8x16`, `i16x8`, `i32x4`,
`u32x4`, `f32x4` and `f64x2`. They are exactly 128 bits wide: the width SSE2,
NEON and wasm simd128 all share. The operations are functions, because
TypeScript has no operator overloading, and `a + b` on two objects is TS2365
before Nish sees the program:

- `load` and `store` from an array at an offset, bounds-checked as a whole
  vector
- `splat`, lane-wise arithmetic and comparisons into a mask
- `select`, `min` and `max`, and horizontal sums
- `extract` and `shuffle` with constant indices
- `any` and `all` on a mask, the test a byte scanner makes on every block
- `bitmask`, which turns a compare into an offset once that test has found a
  hit (§3.2.1 says why the test and the offset are two operations)

Each one lowers to LLVM vector IR (`<16 x i8>`, `<4 x float>`) or a
target-independent `llvm.*` intrinsic such as `llvm.vector.reduce.add`. None
lowers to `llvm.x86.*` or `llvm.aarch64.*`.

**TypeScript reading.** Under Node a vector is a small frozen object of lanes,
and `runtime/nish.mjs` gains the module. That would be the third `nish:`
import the prelude resolves, after `nish:unsafe` and `nish:secret`
([RUN_UNDER_NODE.md](RUN_UNDER_NODE.md)). Floats are class A: `f64` lanes are
`number`, and `f32` lanes use `Math.fround` on every result, as scalar `f32`
does. Integer lanes are the hard part. An LLVM vector `add` wraps, but Nish's
scalar `+` traps on overflow (#426). Making lanes trap would add an
overflow-mask reduction to every operation, which costs the speed the type
exists for. So integer operations wrap, and their names say so (`addWrapping`,
`mulWrapping`), the way `nish:unsafe`'s `wrappingAdd` does. Their reading is
then `| 0`, `Math.imul` or a `& 0xff` mask on each lane: class A, with no
ledger row. Under Node this is slow, an object for every vector. That is the
right side to pay on ([wp33](wp33-round-trip.md) §9).

**wasm and N-API.** With `-msimd128` these lower to simd128 instructions.
Without it, LLVM splits each vector into scalars, which is correct and slow.
Vectors do not cross the host boundary. An exported signature that names one
is refused, the way `wasmSkipReason` (`src/interop-wasm.ts`) already leaves
out the types the loader cannot carry ([wp8](wp8-interop.md)), and the refusal is a negative test.

**Checker rules a type family needs, each with a negative test:**

- a vector in an exported, N-API or wasm signature is refused
- a non-constant lane index to `extract` or `shuffle` is refused
- mixing lane types without an explicit `bitcast` is refused
- a vector as a `Map` key is refused
- `Secret<T>` does not take a vector at first (§6)
- an array of vectors gets a layout pinned by `tests/layout`, because it is
  contiguous storage the C header has to describe

**Cost.** Large. It adds a type family across the checker, the emitter, the
side tables, the `.ll` goldens, `nish.d.ts`, `nish.mjs` and the cookbook. It
is also a permanent part of the language: on 0.x a later change to a lane rule
is a breaking minor, and after 1.0 a major.

**What it withdraws.** Nothing. A `nish:` specifier that did not resolve
before now resolves.

**What it buys.** Hand-vectorised kernels that LLVM does not find, such as
mat-vec in `spectral`, ChaCha20's four-lane quarter round, or a 16-byte
compare-and-bitmask scan. Every one of them stays inside the baseline ISA.

### 3.2.1 What a portable-vector benchmark adds

[Erio-Harrison/simd_benchmark](https://github.com/Erio-Harrison/simd_benchmark)
(read at `eb6294a`) compares Rust's portable `std::simd` with hand-written NEON
on an Apple M4, in nine scenarios. Its first version had `std::simd` ranging
from 9x faster than scalar code to 7.7x slower, and the two APIs up to 2.1x
apart on the same scenario. Each gap traced back to the versions doing
different work. The repository now holds both to four rules:
the same elements per iteration, the same number of accumulators, the same
number of horizontal reductions, and the same algorithm. Under those rules
the two APIs run within 5% of each other in eight scenarios and 9% in the
ninth, where the gap comes from the scalar loop around the vectors and its
addressing mode. More than once the portable code compiled to the very
instruction the NEON code names: a stride-3 shuffle to `ld3`, a lane shift
to `ext`, a widen-add-narrow to `shadd`. That is evidence for §3.3's
decline: a portable surface over LLVM's generic vector IR loses nothing to
intrinsics.

It also bears on five parts of (b) that this note had left open. Each was
checked against LLVM 18 or measured on S0's machine (the 2.1 GHz Xeon, family
6, model 207), at `6da23af` with the 0.16.0 seed.

**1. S3's comparator has to wrap when the vector does.** The benchmark's
fourth finding is that the scalar baseline is often vectorised already, so a
ratio means nothing until the baseline's code has been read. Nish has the
opposite trap. A scalar integer reduction under the checked default keeps
its overflow exit and does not vectorise (§2.1), while `nish:simd`'s integer
lanes wrap (Q3). A ratio of the two measures the overflow check, not the
vectors. So the scalar kernel S3 is judged against makes the same overflow
promise as the vector one: it wraps through `nish:unsafe`'s `wrappingAdd` and
its siblings, and the stage records whether that scalar loop vectorises.

**2. A float comparator gets the vector's summation order by having as many
accumulators.** A one-accumulator `f32x4` loop adds in four interleaved
chains, one per lane. A scalar loop with one accumulator cannot be turned
into that, because without `reassoc` LLVM keeps the source's order of
additions. The same order in scalar Nish
is four accumulators:

```ts
const dot4 = (a: f32[], b: f32[]): f32 => {
  let s0: f32 = 0
  let s1: f32 = 0
  let s2: f32 = 0
  let s3: f32 = 0
  for (let i = 0; i < N; i = i + 4) {
    s0 = s0 + a[i] * b[i]
    s1 = s1 + a[i + 1] * b[i + 1]
    s2 = s2 + a[i + 2] * b[i + 2]
    s3 = s3 + a[i + 3] * b[i + 3]
  }
  return s0 + s1 + s2 + s3
}
```

A program timed this kernel against the one-accumulator loop. `N` was 4,096
and the program made 200,000 calls, bumping one element before each call and
folding every answer into a printed checksum. Each build ran seven times at
`--profile speed`. The times are minimum / median, in ms:

| Build | one accumulator | four accumulators | gain |
| --- | ---: | ---: | ---: |
| `--profile speed` | 542 / 563 | 384 / 415 | 1.41x / 1.36x |
| the same, `--unchecked-indexing` | 527 / 559 | 125 / 133 | 4.2x / 4.2x |
| 0.18.0: `if (b.length < n) { return 0 }`, then `i + 3 < n` | — | 411 / 419 | — |
| 0.18.0: the same guard, and every access through `uncheckedGet` | — | 130 / 133 | — |

With unchecked indexing, LLVM turns the four scalar chains into one loop
over a `<4 x float>` accumulator, `mulps` then `addps`: the code a
one-accumulator `f32x4` kernel would be. In C the same four-accumulator loop
compiles to that loop too, and ran at 0.99x the speed of one written with
SSE2 intrinsics and one `__m128` accumulator. With checked indexing, the
bounds check on each element keeps the loop scalar: its optimised IR has no
vector accumulator.

`--unchecked-indexing` is deprecated (NL9014), so the last two rows repeat the
kernel with the compiler built from `main` (0.18.0) and with `n = a.length`.
A guard that the loop's `i + 3 < n` and `b.length >= n` hold does not help:
the range analysis credits a test of the index itself, `i < n`, and learns
nothing from `i + 3 < n`, so all eight accesses keep their checks. NL9007
warns on only two of them, `a[i]` and `b[i]`, because it speaks only for an
index that is a plain local (`checkSurvivingBoundsCheck`, `src/checker.ts`).
The six offset accesses keep their checks without a word. Writing every
access as `uncheckedGet` inside the same guard gives the unchecked speed
without the flag. Crediting an offset index `i + k` from a test
`i + c < n`, with `0 <= k <= c`, would give it with no `nish:unsafe` at all.

**Since #561, it does.** #561 (on `main` after 0.18.0) credits `xs[i + c]`
from a guard on the sum (`offsetIndex` and `belowReach`, `src/bounds.ts`).
The 0.18.0 rows above predate it. At `5403a55`, the same kernel, with
`const n = a.length`, `if (b.length < n) { return 0 }` and the loop's
`i + 3 < n`, keeps no bounds check in `dotGuarded`. Its `--profile speed`
binary is byte-identical to the one built from the same kernel with every
access through `uncheckedGet`, and `opt -O3` gives it the `<4 x float>`
accumulator. Without the `b.length` guard, the four `b` accesses keep their
checks, NL9007 now warns on each of the four, offset ones included, and the
loop stays scalar. Timed at `--profile speed` on the 2.1 GHz Xeon (4 vCPUs,
AVX2), nine interleaved rounds of 200,000 calls over 4,096 elements, one
element bumped before each call, every answer folded into the printed
checksum 44904233791, minimum / median in ms:

| Build | min | median |
| --- | ---: | ---: |
| guarded, checked indexing | 126.3 | 128.9 |
| its byte-identical copy | 123.9 | 135.1 |
| guarded, `uncheckedGet` (the same bytes) | 122.6 | 131.3 |
| without the `b.length` guard | 153.4 | 163.4 |

The first three are one binary, so they differ only by the machine's noise,
3% at the minimum and 5% at the median. The unguarded build is 21% slower
than the guarded one at the minimum, outside that band.

For a float kernel, then, much of what
S3 could show over scalar Nish is available to scalar Nish already, and the
bounds checks stood in the way until #561. It is (d)'s loop-shape work (§3.4) as much
as (b)'s. S3's float comparator therefore has one scalar accumulator for
every lane of the vector kernel's accumulators, and the stage reports it
under both indexing modes.

**3. 128-bit lanes do not split an accumulator for a program.** In the
benchmark's dot product, `f32x8` on NEON is two registers and so two
independent chains. A hand-written loop with one `f32x4` accumulator was
1.4x to 2.2x slower than one with two, depending on the API and the run.
Under Q4 no `nish:simd` type is wider than 128 bits, and LLVM does not
reassociate a float accumulator into several, so a program gets more chains
only by writing them. On S0's machine, an L1-resident dot product in C with
SSE2 intrinsics, run seven times, took (minimum / median, ms): one
accumulator 119.3 / 123.5, two 62.2 / 63.5, four 51.8 / 53.6. That is 1.9x
from the second accumulator and 2.3x from four. The gain follows the core's
float-add latency, so it differs from machine to machine. The S3 cookbook
entry for a float reduction shows the several-accumulator form, and S3's
numeric kernel and its comparator have the same number of accumulators
(rule 2 of the four).

**4. The per-block test is `any`, not `bitmask`.** Lowered by `llc -O3`
after `opt -O2`, a 16-lane compare followed by each of the two reductions
costs these instructions, not counting the return:

| Operation | AArch64 | x86-64 baseline | x86-64-v3 | wasm simd128 |
| --- | --- | --- | --- | --- |
| compare, `bitcast <16 x i1> to i16` (`bitmask`) | 8: `cmeq`, a constant-pool load, `and`, `ext`, `zip1`, `addv`, … | 2: `pcmpeqb`, `pmovmskb` | 2 | 2: `i8x16.eq`, `i8x16.bitmask` |
| compare, `llvm.vector.reduce.or.v16i1` (`any`) | 4: `cmeq`, `umaxv`, … | 4: `pcmpeqb`, `pmovmskb`, `test`, `setne` | 4 | 2: `i8x16.eq`, `v128.any_true` |

NEON has no `movemask`, so a bitmask is assembled from several instructions,
while an "any lane set?" reduction is one `umaxv`. The benchmark's byte
search runs at about one iteration per cycle by testing `any` on every block
and building the position only on a hit. With `bitmask` as the only
reduction, every block on AArch64 would pay the assembly. The narrowing
shift `runtime/runtime-simd.c` uses on NEON is cheaper, but it gives four
bits a byte rather than one, so it is not `bitmask`. It fits an operation
that answers the index of the first set lane, which S3 adds only if it
measures faster than `bitmask` on AArch64.

**5. A fused multiply-add is not in the baseline.** `llvm.fma.v4f32` lowers
to one `fmla` on AArch64 and one `vfmadd213ps` at `x86-64-v3`. At the x86-64
baseline and on wasm simd128 it becomes **four calls to the C library's
`fmaf`**, one per lane. The
benchmark recommends `mul_add` for Rust, but Nish's default target is the
baseline (Q2) and the language refuses contraction (§9). So (b) offers no
`mulAdd`. A multiply and an add stay two operations, rounded twice, as
scalar `*` and `+` are. One would come back only with a CPU level that has
FMA (S2), and it would have its own rule.

**Q4's cost: a deinterleaving load.** The benchmark's RGB scenario loads 48
bytes and takes every third byte with three shuffles. On AArch64 that
compiles to one `ld3`, the instruction NEON's `vld3q_u8` names. Q4 allows no
48-byte vector, so a `nish:simd` program writes three 16-byte loads and
two-input shuffles, and LLVM does not find the `ld3`:

| The same three lanes, from | AArch64 | x86-64 baseline | x86-64-v3 | wasm simd128 |
| --- | ---: | ---: | ---: | ---: |
| one `<48 x i8>` load and three stride-3 shuffles | 4, with `ld3` | 113 | 18 | 6 `i8x16.shuffle` |
| three `<16 x i8>` loads and two-input shuffles | 23, with 6 `tbl` | 113 | 24 | 6 `i8x16.shuffle` |

On the x86-64 baseline and on wasm the two forms cost the same. AArch64
loses the most, and `x86-64-v3` a little. Q4 stands. This is the price of it, recorded so that an
interleaved-data kernel that misses S3's bar on AArch64 is read correctly.

To reproduce the lowering tables, write each row as a function in a `.ll`
file and run `opt -O2 -mtriple=<t> f.ll -S -o - | llc -O3 -mtriple=<t>`,
with `-mcpu=x86-64-v3` or `-mattr=+simd128` for those columns. The
`bitmask` and `fma` rows are:

```llvm
define i16 @bitmask(<16 x i8> %v, <16 x i8> %w) {
  %c = icmp eq <16 x i8> %v, %w
  %m = bitcast <16 x i1> %c to i16
  ret i16 %m
}
define <4 x float> @fma(<4 x float> %a, <4 x float> %b, <4 x float> %c) {
  %r = call <4 x float> @llvm.fma.v4f32(<4 x float> %a, <4 x float> %b, <4 x float> %c)
  ret <4 x float> %r
}
declare <4 x float> @llvm.fma.v4f32(<4 x float>, <4 x float>, <4 x float>)
```

### 3.3 (c) Explicit target intrinsics

**What.** These would expose `llvm.x86.*` and `llvm.aarch64.*` operations, or
a C-header-style set like `_mm_cmpeq_epi8`, to programs.

**Why not.** Each intrinsic only exists on one instruction set, so a program
that uses one no longer compiles for every `--target` that `src/target.ts`
knows, and its IR is no longer target-neutral. Its only TypeScript reading is
an emulator of that instruction. That is class D in
[wp33](wp33-round-trip.md) §2's terms, which rule 2 there refuses. The
constant-time checker reads the baseline CPU only. [CT-5 and CT-6](security/ct-verification.md)
record BMI2 and AVX-512 instructions it had to be taught to model although CI,
building for the baseline, never emits them, and CT-16 leaves the rest open.
Every intrinsic above the baseline widens that gap. The one strong case is AES-NI and
PCLMULQDQ for `std/crypto/aes.ts`, which is bitsliced so that no table is ever
indexed. That case belongs under §3.1 as a runtime kernel and §6's rules, and
S5 put it there ([§2.3](#s5-aes-gcm-the-result)) without a language surface.
**Declined** (§9).

### 3.4 (d) Auto-vectorisation, and the `-march` policy

**What.** Two separate things:

1. **Loop shapes.** The checked default keeps an overflow exit in a reduction,
   and a bounds check adds a second exit. Each one blocks the vectoriser
   (§2.1). Every proof that removes one gives a counted loop back, which is
   what WP15's bounds pipeline and the `nsw` proofs of #426 already do. This
   needs no new surface. It is ongoing, and each step is measured on its own.
2. **A CPU level.** This would be an opt-in `--cpu` flag. Its values would be
   levels like `x86-64-v2`, `x86-64-v3` and `armv8.2-a`, plus `native` for a
   binary that never leaves the machine that built it. It passes `-march` to
   clang for the module and the runtime alike.

**TypeScript reading: class A.** The source does not change, and neither does
what any operation means, provided nothing is fused. The emitted IR carries no
`contract` flag, but clang compiles C with `-ffp-contract=on`, so on a level
with FMA `runtime.c`'s float code could round differently. The flag therefore
also passes `-ffp-contract=off` for the runtime. `-ffast-math` stays refused,
as [bench/README.md](../bench/README.md) refuses it for C.

**What it buys.** §2.3 bounds it: about 10–12% on nbody and vec3 for Rust, and
nothing on spectral or sieve.

**What it withdraws.** Nothing, as long as it stays a flag. Making it the
default would withdraw something real: a release binary that dies with
`SIGILL` on an older CPU. §5 refuses that.

---

## 4. The rolling freeze and `src/`

`src/` is built by the last release, so it may use a new construct only from
the release that ships it (CLAUDE.md). For (a), the lexer can call the
`std/text` function from the release after it lands. Until then, `src/`'s
self-compilation time is the place to measure what it would buy:
`scripts/bootstrap.sh --verify`, before and after. That release is 0.18.0,
and S4 was measured there and declined (§7): the lexer is too small a part of
the bootstrap for the call to move it. For (b), the same rule
applies, and the lexer is unlikely to need it if (a) is enough. (d) touches no
source, so `src/` gets its loop shapes on the next bootstrap.

---

## 5. The target policy

- **The default target stays the baseline**: SSE2 on x86-64, ARMv8-A with NEON
  on AArch64. This keeps three things true. A release binary runs on every
  machine of its triple. The instruction gate counts the same code on every
  host. The constant-time checker reads what ships.
- **Wider code is chosen at run time, inside the runtime** (§3.1). This is the
  answer simdjson and glibc give, and the only one that keeps a single binary
  per triple.
- **Asking for a wider target is opt-in, and is a flag** (§3.4). The level a
  binary was built for is recorded where a deployer can read it, such as the
  capability report ([wp35](wp35-capabilities.md)).
- **wasm.** `-msimd128` is a level for the wasm and wasi profiles, behind the
  same flag. Node 22, the version the suite runs, has simd128, but a host that
  lacks it refuses the whole module, so the default stays without it until a
  measured stage says otherwise.
- **The prebuilt `nish` compiler** ([wp12](wp12-release.md)) stays baseline. It
  would get any SIMD speed from (a), not from a wider target, and §7 records
  that its lexer is not where that speed is.

---

## 6. `Secret` and constant-time code

Byte search is variable-time on purpose: it stops at the first match.
`src/secret.ts`'s `isPureRuntime` lists the runtime symbols that `expose` may
reach. It already lists `nish_str_index_of`, because the list is about
effects, not about timing. A new kernel goes on that list only with a reason
written beside it, and it is documented as variable-time. `std/crypto` must
not call it on secret data. The asm check only reads the fixtures it names,
so that rule rests on review, as every loop in `std/crypto` does today
([LANGUAGE.md](LANGUAGE.md#constant-time-ctselect-and-cteq)).

(b) is the option that suits constant-time code. A fixed-width lane operation
has no data-dependent exit, and at 128 bits it stays inside the baseline ISA
the checker reads. A wipe cannot reach a vector register, though, so a vector
holding key material would need a record in its area's audit, as ECC-2 and
X509-7 have for scalars. `Secret<T>` does not take a vector until that record
exists. (c) and (d) both leave the checker's reach: CT-16 is open for exactly
that reason. So the `--cpu` flag of (d) ships only once `tests/ct-asm.js`
reads each level the flag accepts (§7 S2), and `tests/ct-asm-runtime.js`
reads the runtime's kernels at it too, since the flag compiles the runtime at
the level. §7 measures what that costs at each level. Refusing the flag for programs
that import `std/crypto` is not offered instead: a package can reach
`std/crypto` through another package, and the checker's reading, not an
import rule, is what the constant-time promise rests on.

---

## 7. Stages, and the bar each must clear

Every stage keeps [wp33](wp33-round-trip.md) §1 rule 6. The `.ll` goldens of
programs that do not use the stage do not move, and `node bench/run.mjs
--instructions --check` passes with `bench/instructions.json` unchanged. Every figure comes
from the same machine, as a minimum and a median of at least seven runs, from
a loop whose input changes on every iteration and whose answer is folded into
a printed checksum.

| Stage | What | Ships only if |
| --- | --- | --- |
| **S0** | Measurement, nothing built. It records the baselines that S1–S3 are judged against: `bench/json` after #507's stage 3, `bench/scan.ts` natively and as wasm, nbody, vec3 and spectral at the baseline and with `-march=x86-64-v3` on the same `.ll`, and `scripts/bootstrap.sh --verify`. | It is written into this note's §2.3 with the commit it was taken at. **Landed (#517)**: [S0: the baselines](#s0-the-baselines), at `97210d5` and `c4dd861`, and `f33139a` for `bench/json` (taken by `s1-json`). |
| **S1** | (a): the find-first-of-a-set kernel, its `std/text` function and the compiler's recognition of it. `std/json`'s structure scan and string skip move onto it. | `bench/json` with `jsonFields` is **at least 1.5x faster** than §2.3's S0 row, on the same machine. None of #507's non-benchmark shapes is slower: a compiler `--json` line, a 50-key object with the field last, a miss, and a line of short strings only. The kernel's three paths agree on a fuzzed corpus. The runtime stays within its budget. **Kernel landed (#518), surface landed (#519)**: `runtime/runtime-simd.c` and `indexOfAny` in `std/text`, with the three paths' agreement test. **`bench/json` bar missed**: no variant was reliably faster than S0 (one median leaves the noise band, from S0's own outlier median in that row), none came near 1.5x, and `std/json` is unchanged ([§2.3](#s1-stdjson-on-indexofany-the-bar-missed)). |
| **S1b** | (a): the block classifier, only if S1 misses its `bench/json` bar | It reaches S1's `bench/json` bar where S1 alone did not, under S1's other conditions. **Not built; designing it is the owner's call** (below). |
| **S2** | (d): the `--cpu` flag | A **≥10%** gain at one level on at least one of nbody, vec3 or spectral, with no loss on the others. `tests/ct-asm.js` reads every level the flag accepts, and its fixtures pass at each one (§6). **Bar met on a re-measurement**: see below. **Decided 2026-10-16 (Q7)**: `x86-64-v3` only, for the module and the runtime alike; planned in [the S3a and S2 plan](../.claude/plans/wp38-s3a-cpu-flag.plan.md). **Built (`d835d40`)**: `nish --link`, `nish run` and `scripts/build.sh` take `--cpu x86-64-v3` and refuse every other value; `ct_asm` reads x86-64 at that level for the fixtures and the runtime (CT-16, narrowed). |
| **S3** | (b): `nish:simd` | A kernel written with it is **≥1.5x** faster than the same kernel in scalar Nish at the default target. It must do that on a numeric program from `bench/` and on a byte scan that S1's kernel cannot express (`bench/scan.ts`'s depth counting). The scalar kernel does the same work (§3.2.1): its integer arithmetic wraps where the lanes do, it has one accumulator for every lane of the vector kernel's accumulators, and it is timed under both checked and unchecked indexing, with the record saying whether it vectorised. The aligned scalar kernel can be faster than a naive one. In §3.2.1 a four-accumulator scalar dot product ran 4.2x faster than a one-accumulator one under unchecked indexing. Every operation has a golden, a negative test and a Node reading checked by a native round trip. **Not built; decided on S3a's figures (Q8, decided 2026-10-16)**: see below. |
| **S3a** | Measurement for S3, nothing built: S3's two bar kernels (a numeric program from `bench/` and `bench/scan.ts`'s depth counting) written in C with portable `vector_size(16)` vectors, the LLVM vector IR `nish:simd` would lower to, against the scalar Nish comparator S3's bar describes. Taken after S7. | It is written into this note's §2.3 with the commit it was taken at, with both indexing modes and whether each scalar loop vectorised. **Landed (#658)**, taken at `46a1e4d` (§2.3, S3a): the C vector form beats Nish checked by 1.65x on mat-vec and by 1.81x and 3.51x on the two depth documents at the median, outside a noise band within 5%, so both kernels clear 1.5x on x86-64; no AArch64 machine was at hand. |
| **S4** | `src/`'s lexer on S1's function, from the release after S1 | `scripts/bootstrap.sh --verify` is measurably faster, and its fixed point is reached. **Declined for now**: see below. |
| **S5** | (a): AES-GCM as a runtime kernel. `std/crypto/aes.ts`'s key schedule, single block, GCTR and GHASH go to AES-NI and PCLMULQDQ, or ARMv8 AES and PMULL, chosen at run time. The bitsliced code stays as the fallback, the Node reading and the wasm path | AES-128-GCM seal on 16 KiB is **at least 5x faster** on x86-64 with AES-NI than [S5's baseline](#s5-aes-gcm-the-baseline): a minimum of 76.04 ms for 4 MiB, so a minimum at or under 15.208 ms, which is 275.8 MB/s or more. The fallback path is not slower than that baseline, outside the noise band (3.0% at the minimum, 11.1% at the median), on any of `bench/aes-gcm.ts`'s nine workloads. **Baseline measured at `ce9d394`**, before anything is built. A curl `--http2` transfer spends 77% to 81% of the server's instructions in `std/crypto/aes.ts` on the AES suites. So S5's stop rule, which ends the stage with nothing built if real clients do not negotiate AES or AES is a negligible share of the server's CPU, does not apply. **Bar met, at `0db1292`** ([§2.3](#s5-aes-gcm-the-result)): re-run on another Xeon beside the kernel in the same interleaved rounds, AES-128-GCM seal on 16 KiB went from 42.76 ms to 1.11 ms at the minimum, 98.1 to 3,765 MB/s, **38.5x** (33.1x at the median); the bitsliced fallback, run as `NISH_AES=soft`, meets the bar at the median, 11.1%, on all nine workloads (its worst AES figure +1.4%). In those three samples, at the minimum the pre-registered 3.0% band does not hold on that machine, where a binary's minimum moves by up to 27.5% against its own copy, and read against the copy in the same rounds every AES workload's fallback minimum is within that spread (two ChaCha20-Poly1305 minima, code the change does not touch, sit just past it in one sample). **The bar holds at the minimum too, against `ce9d394` itself, at `b515c1b`** ([§2.3](#s5-aes-gcm-the-result)): a fourth sample, 48 rounds on a host where the byte-identical copy stayed within 1.4% at the minimum, puts every workload's fallback minimum within +3.0% of `ce9d394`'s (worst +0.8%) and every median within 11.1% (worst +2.0%). That is the raw comparison the bar names. The untouched ChaCha20-Poly1305 rows ran 3.4% to 5.8% faster than `ce9d394` in the same sample, and corrected for that drift `aesHeaderMask`'s minimum could be 4% to 7% slower, so the drift-corrected minimum is open ([§2.3](#s5-aes-gcm-the-result)). |
| **S6a** | (a): byte-class run kernels on `u8[]` for `JsonTokenizer` and `JsonWriter`: the first index at or after `from`, below `limit`, whose byte is *not* a blank, a digit, or a plain string byte, each class fixed in its kernel, with no set to splat (§7, S6) | On `bench/json-compare` against the `06645ecf` record ([§2.4](#24-jsontokenizer-after-json-parity-the-gap-s6-is-aimed-at)), tokenize on twitter.json and citm_catalog.json are **at least 1.2x** faster at the minimum, and serialize on citm_catalog.json is faster outside its band. No corpus or workload is slower outside its band, and `bench/json-tokenizer`'s 242-byte body is not slower: short runs pay no call. The scalar, 16-byte and 32-byte paths agree on a fuzzed corpus that puts every class boundary at every offset of a block. JSONTestSuite's verdicts, the conformance corpus, the fuzz checksum and #582's mutation-pinned boundaries are unchanged. The unit stays within its ceiling. **Tokenize bar met; serialize not reached by S6a**, recorded at `96899c1` ([BENCHMARKS.md](BENCHMARKS.md#json-against-other-languages), 14 rounds). Against `06645ecf`'s minimums, tokenize on twitter went from 1,247,246 to 737,985 ns (**1.69x**) and on citm from 2,397,781 to 1,468,015 ns (**1.63x**). Against simdjson On-Demand in the same rounds, Nish is now 1.55x behind on twitter (2.20x before S6a) and 1.24x behind on citm (1.59x before), and it trails simdjson by 1.10x on canada. Serialize on citm is 675,503 ns against `06645ecf`'s 870,432, but that gain came before S6a: S6a left `JsonWriter` unchanged, its escape scan is a follow-up, and serialize did not move outside its band against the previous record. In the A/B against the S6b head, canada ran 0.931x, outside the band; see *S6a, the byte-class kernels: what was built*. The host was noisier during this record: every other implementation's minimum rose by 5% to 7% against the previous one, and Nish's bands against its own copy reached 6.6% on citm and 7.3% on typed decode. `bench/json-tokenizer`'s 242-byte body was not measured again. The paths' agreement (`tests/simd/byte-runs.c`), JSONTestSuite, the conformance corpus and the mutation-pinned boundaries pass, and the unit is at 1,303 of 1,536 bytes. |
| **S6b** | Eisel–Lemire in `numberF64`, in Nish: a 128-bit product of the significand and a table of powers of five, with `parseFloat` kept for more than 19 significant digits. Not a vector; it is here because it is most of canada's gap (§2.4) | Tokenize on canada.json is **at least 1.5x** faster than the `06645ecf` record at the minimum, and twitter and citm are not slower outside their bands. Every `numberF64` answer is bit-for-bit `parseFloat`'s on canada.json, on every JSONTestSuite number, and on at least 10^8 random doubles printed shortest and at 17 digits, and under Node. **Met.** canada 18.0 → 6.5 ms, 2.78x against the branch it was built on and 3.4x against the record; citm 1.17x faster, twitter unchanged. Bit-for-bit on canada's 978,519 numbers, JSONTestSuite and 10^8 random doubles at both widths (2×10^8 strings), natively and under Node, which runs the same Nish code. |
| **S6c** | (a): the block classifier (S1b) re-aimed at `JsonTokenizer`: masks of quotes, backslashes, structural bytes and blanks per 64-byte block, the in-string mask by prefix XOR, and the tokenizer walking set bits | Only after S6a and S6b. Tokenize on twitter.json and citm_catalog.json is **at least 1.5x** faster than the record S6b leaves, and typed decode of citm_catalog.json is faster outside its band. Every error code and `errorAt` offset is unchanged on every JSONTestSuite `n_` file and the conformance corpus. A document's index costs at most one bit a byte plus one block, reused across documents. **Design written, awaiting the owner (§8, Q5)**: see *S6c, the structural index: the design* below. Nothing is built. |
| **S7** | (d), a loop shape: the range analysis credits an offset index `i + k` from a test `i + c < n`, with `0 <= k <= c` and `n` an array's length, so the access keeps no bounds check. No surface | §3.2.1's four-accumulator dot product, with checked indexing and no `nish:unsafe`, reaches the speed of its `uncheckedGet` form within the noise band, and its optimised IR holds the `<4 x float>` accumulator. An access the test does not bound keeps its check, with a negative golden each for `k > c`, a negative `k`, and a test against another array's length. **Met by #561** (Q9): at `5403a55` the guarded kernel compiles to the same `--profile speed` binary as its `uncheckedGet` form, with the `<4 x float>` accumulator; #561's own entry measured it 3.1x faster than before, against a 2.4% band (§3.2.1, and below). |

**S1b: what the classifier could buy, and what it needs decided.** S1
missed its bar because a per-call search has nothing to jump on `bench/json`
([§2.3](#s1-stdjson-on-indexofany-the-bar-missed)). The classifier
([§3.1](#31-a-runtime-kernels-chosen-at-run-time), the second kernel) takes
the call out of each structural byte. On §2.3's profile it can remove at most
the scan's string windows, depth loop and blank skip, 51 M of the 138 M
instructions, and it keeps a floor of its own. That floor is an estimate, not
a measurement. A `bench/json` line is about 436 bytes, seven blocks to
classify, and holds about 104 bytes from `"{}[]:,\`, one every 4.2 bytes,
those inside strings included. At about 20 instructions to classify a block
and about 3 to walk each bit, that is about 440 instructions a line, about
9 M per 20,000 lines. It leaves about 42 M against the 46 M that 1.5x needs,
a margin well within the estimate's error. So S1b alone may not reach the bar
either: it may also need the per-member work, the key comparisons
(18 M) or the unescaping (17 M) made cheaper, or the bar restated. And
`jsonField` takes the text afresh on every call, so the harness's three calls
would classify each line three times. Where the masks live between calls (a
parsed-line handle, or `jsonFields` only) is an API decision that comes with
S1b. It changes `std/json`'s reader from a member loop over offsets to a loop
over masks, so it is a design to be written and decided before anything is
built.

**S2 was declined on S0's figures, on its own bar.** spectral clears 10% in both of
§2.3's alternating samples (10.7% and 14.7%, then 21.3% and 14.8%, minimum
and median), but vec3 is at or below zero in three of its four figures
(−0.3%, then −1.2% and −1.0%), so "no loss on the others" is not met, and the
bar gives no tolerance. The flag was not built then, `tests/ct-asm.js` read only
the baseline, and LANGUAGE.md gained no rule; it is built now (`d835d40`). It reopens on a re-measurement on
a quieter machine, or on a measurement of the noise itself: one binary timed
against itself, showing vec3's dip lies inside it. `bench/simd-s0.mjs` only
timed the two builds against each other then.

**The noise, measured: S2's bar is met.** `bench/simd-s0.mjs --self` puts a
byte-for-byte copy of the baseline binary into the rotation as a third
column, so the baseline is timed against itself in the same rounds as against
`-march=x86-64-v3`. Two samples of fifteen rounds of three, at `1d16469` on
the same 2.1 GHz Xeon, gave (minimum / median):

| Benchmark | x86-64-v3 against the baseline | the baseline against its copy |
| --- | ---: | ---: |
| spectral | +20.8% / +19.7%, then +21.1% / +20.5% | −0.2% / +0.3%, then 0.0% / +0.1% |
| vec3 | +1.2% / +1.5%, then +1.7% / +1.1% | 0.0% / +0.2%, then +0.2% / −0.3% |
| nbody | +0.3% / +1.1%, then −0.8% / +0.9% | +0.2% / +0.1%, then −1.1% / −0.3% |

- **vec3's dip does not reproduce.** All four of its figures are now gains,
  of 1.1% to 1.7%, while the baseline differs from its own copy by 0.3% at
  most.
- **nbody has one negative figure:** −0.8% on the minimum in the second
  sample. In the same sample the baseline's minimum was 1.1% below its own
  copy's, so that figure is inside the noise. Its medians are gains in both.
- **spectral gains about 20%** on both figures in both samples.

So spectral clears 10%, and nothing else loses by more than a binary loses to
itself. That is the reading this paragraph asked for, and S2's bar is met on
it. The flag was still not built then (it is now, `d835d40`): what it costs is mostly `tests/ct-asm.js`
reading every level it accepts (§6), and whether a gain on one benchmark of
three is worth that is the owner's decision.

**What reading every level costs, measured.** §6 lets the flag ship only once
`tests/ct-asm.js` reads every level it accepts. Whether that is new modelling
or only more runs was measured before anything is built, at `6752a82` with the
0.18.0 seed and Ubuntu clang 18.1.3. The nine `tests/cases/ct_asm_*.ts`
fixtures were compiled to `.ll` as `tests/run.js` compiles them, then to `.s`
with its own `clang -O2 -S` line plus one `-march` or `-mcpu`, and every
`ct-check` function was read with `ctViolations`, 50 readings a target.
`runtime/runtime-aes.c` was compiled with `tests/ct-asm-runtime.js`'s line plus
the same flag and read by that file's checker: its export check, its four
kernels and its two leaky variants, seven readings a target.

| Level | Nish fixtures, 50 readings | `runtime-aes.c`, 7 readings |
| --- | --- | --- |
| baseline, both targets | all pass | all pass |
| `x86-64-v2`, `x86-64-v3`, `x86-64-v4` | all pass | all pass |
| `armv8.2-a`, `armv8.4-a+crypto`, `-mcpu=apple-m1` | all pass | all pass |
| `armv9-a`, `-mcpu=neoverse-v1` (SVE) | **3 fail** | **1 fails** |
| `native` | — | — |

- **The passes read real code above the baseline.** At `x86-64-v3`,
  `ct_asm_x25519`'s listing holds 270 BMI2 and AVX instructions (`mulx`,
  `shlx`, `rorx`, `andn`, `v…`) and `runtime-aes.c`'s holds 196 VEX-encoded
  `vaesenc`, `vpxor`, `vpshufb` and `vpclmulqdq`, where the baseline holds
  none. CT-5, CT-6, CT-17 and CT-18 had already taught the model those
  instructions. A pass says the model finds no violation, not that it is
  complete for VEX and EVEX forms: CT-17's instructions were misread while
  every check passed.
- **The SVE levels fail, though nothing leaks.** `macEqual` and both
  `timingSafeEqual` functions become a loop over the vector length (`cntw`,
  `incw`, `ld1b {z1.s}, p0/z`), so they branch on a public counter, and
  ct-asm.js refuses every branch. `nish_aes_schedule` gains a predicated
  `st1w {z0.s}, p0`, which the model does not follow (`unmodelled`). Reading
  them would need ct-asm-runtime.js's control flow for the Nish fixtures and
  an SVE model for both.
- **`native` cannot be read.** It names whatever CPU builds the program, which
  no CI run has seen. It passes on the machine that measured it, which proves
  nothing about any other, so §6's condition rules it out.
- **No x86-64 level holds AES-NI or PCLMULQDQ.** clang defines neither
  `__AES__` nor `__PCLMUL__` at `x86-64-v2`, `v3` or `v4` (v3 adds AVX2, BMI2
  and FMA; v4 adds AVX-512). So the flag never makes S5's branch on
  `nish_aes_hw` redundant, and gives `std/crypto` nothing. What it buys is
  auto-vectorisation: spectral's 20%.

To reproduce one cell, build a fixture with `build/nish
tests/cases/ct_asm_mac.ts -o mac.ll`, compile it with `clang -O2 -S
-Wno-override-module --target=aarch64-unknown-linux-gnu -march=armv9-a mac.ll
-o mac.s`, and pass `functionBody` of `macEqual` with its `ctSpecs` spec to
`ctViolations` (all three exported by `tests/ct-asm.js`). For the runtime, add
the same flag to `runtimeAsm`'s clang line in `tests/ct-asm-runtime.js` and
call `runtimeChecks`.

**S2: the recommendation (Q7, decided 2026-10-16).** Build the flag with one value,
`--cpu x86-64-v3`, and refuse every other, `native` included. Only `x86-64-v3`
has met the bar; the bar is per level, and a value with no measurement behind
it is a promise without evidence. An AArch64 level or `x86-64-v4` comes later,
each on its own measurement and its own pass of both checkers. The level
applies to the module and the runtime alike, as §3.4 says. Compiling only the
module at the level would leave the runtime's kernels at the baseline, but it
is not exact under the speed profile's LTO, where a baseline runtime function
inlined into a module function is compiled at the module's level.

What it costs, one pull request:

- `src/compile.ts` parses the flag and hands `-march=x86-64-v3` and
  `-ffp-contract=off` to `scripts/build.sh` for every unit; the wasm and wasi
  profiles refuse it; the capability report records the level
  ([wp35](wp35-capabilities.md)).
- `tests/run.js`'s two `ct_asm` sections read x86-64 once more, at the level:
  the fixtures and `runtime-aes.c`. Every later fixture and kernel is read at
  both, for as long as the flag accepts the level.
- Driver tests: the flag builds and runs, and an unknown level and `native` are
  each refused, with a negative test.
- The rule in LANGUAGE.md, the guide's CLI page, and CT-16 in
  [ct-verification.md](security/ct-verification.md) narrowed to the levels
  read.
- No rolling-freeze cost. `src/` gains a flag and uses no new construct, and
  the prebuilt compiler stays baseline (§5). The change still runs `node
  tests/run.js wasi` and `node tests/run.js performance` and regenerates the
  checked goldens, as every `src/` change does.

S7, which was to come first, is already built (#561).

**S3: what stands in front of it (Q8, decided).** §3.2.1 already shows scalar
Nish reaching the vector code for a float kernel. A four-accumulator dot
product without bounds checks compiled to the same `<4 x float>` loop a
one-accumulator `f32x4` kernel would be, 4.2x faster than one accumulator, and
its C twin ran at 0.99x the speed of SSE2 intrinsics. What stands in the way is
the bounds check on each offset access, which the range analysis did not
credit from the test `i + 3 < n` until #561. Since #561 it does (§3.2.1), so
S3's numeric half is likely won already, with no surface. Its byte half is a scan `indexOfAny` cannot express, such as
`bench/scan.ts`'s depth counting, which a block classifier (S1b, re-aimed as
S6c) would also reach, in the runtime. Against that, S3's surface is large and permanent: six types,
about a dozen operation families, six checker rules with their negative tests,
a third `nish:` module in `nish.mjs`, `nish.d.ts`, a layout test, a golden for
every operation, its guide page, cookbook entry and LANGUAGE.md rule, and a
breaking change for any later lane rule. About 29 files of `src/` handle
`nish:unsafe` or `nish:secret` today, a rough measure of where a third module
reaches. Under the rolling freeze `src/` could implement it but not use it
before the next release, and it has no use for it (S4 was declined). Each
`src/` pull request of the series also regenerates the checked goldens and
must leave the NL9007 ratchet where it was.

So the order, decided on 2026-10-16, is S3a, then S3 decided on S3a's
figures: if neither of S3a's kernels clears 1.5x, S3 moves to §9; if only the
byte kernel does, S3 is weighed against S6c's classifier on that kernel.

**S4 is declined for now on its own bar.** The lexer is about 1% of the front
end, and the front end's three runs about 2% of `scripts/bootstrap.sh
--verify`, so no change to the lexer, however fast, can make the bootstrap
measurably faster. The figures were taken at `308a8b1`, with stage2 built from
the 0.18.0 seed, on a 4-vCPU cloud container (Intel Xeon at 2.10 GHz).
`bench/lexer.ts` lexed `src/*.ts` concatenated, 2,804,018 bytes, and printed
338,856 tokens per pass; 41% of the bytes are in comment lines. One lex took
9.82 ms at the minimum, about 285 MB/s, and 11.62 ms at the median (nine runs
of 25 passes: the least minimum, and the median of the runs' medians). A
spike, given below, put `skipTrivia`'s two comment loops on `indexOf`. In
alternating rounds it took 9.46 ms and 10.50 ms, 4% faster at the minimum and
10% at the median, with the same checksum and token count, and
`src/dump-tokens.ts` built both ways printed `cmp`-equal output. The comment
loops are the only part of the lexer that was measured on a search.
String-literal bodies have `indexOfAny`'s shape too, since `scanString` runs
until a quote, a line feed or a backslash, but they were not measured;
identifiers and numbers run *while* a byte is in a class, which `indexOfAny`
does not express. None of that changes the reading, which rests on the lexer's
share alone. `build/nish src/compile.ts`, the front end and IR for all of
`src/`, took 919 ms at the minimum and 1,046 ms at the median over fifteen
runs, and 913 and 1,026 ms with the spike: a difference well inside the runs'
own spread of 913 to 1,538 ms. `scripts/bootstrap.sh --verify` reached its
fixed point in 135,556 ms, in one run rather than seven: it serves only as the
denominator of the lexer's share, and a share of 0.02% stays far below a
measurable effect whatever one run's noise. S0's 150,771 ms was taken on
another machine, so what compares is each part's share of a run, not the
times. The bootstrap runs the front end three times, once per stage, so the
lexer is about 30 ms of it, and the spike would save about 1 ms. The spike was
measured and reverted, and `src/` is unchanged. S4 reopens on a front-end
profile that shows a scan-bound loop in `src/`, or on a bar restated in
front-end time.

To reproduce the spike, replace the bodies of the two comment branches of
`Lexer.skipTrivia` in `src/lexer.ts`, the `this.pos = this.pos + 2` and the
`while` loop after it in each, with these lines:

```ts
// the `//` branch: to the line feed, or the end of the text
const lf = this.source.indexOf("\n", this.pos + 2)
this.pos = lf < 0 ? this.source.length : lf
// the `/*` branch: past the `*/`, or to the end of the text
const close = this.source.indexOf("*/", this.pos + 2)
this.pos = close < 0 ? this.source.length : close + 2
```

Then build `bench/lexer.ts` once against each version of `src/lexer.ts`, and
run the two binaries over the same `src/*.ts` in alternating rounds, as its
header shows for one; for the front-end figures, build stage2 with `npm run
build` against each version and time `src/compile.ts` with the two in the same
alternation. Revert the spike with `git checkout src/lexer.ts`.

**S6: putting the JSON tokenizer on vectors.** §2.4 has the gap and the
baseline. S6 is three stages, in order. Each one is its own pull request and
is judged on its own bar against the record the stage before it leaves. Each
one keeps every rule of [S1](#s1-stdjson-on-indexofany-the-bar-missed)'s
measurement: interleaved rounds, a byte-identical copy as the noise band, and
callgrind instruction counts per part of the loop, because S1 showed that a
kernel's call can cost more than the bytes it skips.

*S6a, the byte-class kernels: what was built.* The plan asked for three
kernels, a `std` surface, a short-run guard and four callers. Each part was
built, but the writer was not changed, and three parts differ from the plan:

- **A unit of its own, `runtime/runtime-bytes.c`.** The plan placed the kernels
  in `runtime/runtime-simd.c`. Together they measured 1,960 bytes, which is
  past that file's ceiling. So they have their own unit and ceiling, as the
  AES kernels do: 1,303 bytes of `.text*` against `RUNTIME_BYTES_TEXT_BUDGET`'s
  1,536, with a row in wp7's budget table. The paths and the resolver are
  #518's: scalar, SSE2, NEON or simd128, and AVX2, chosen on the first call
  and pinned by `NISH_SIMD`. The exception is a freestanding wasm32 build,
  which has no libc to read the pin. There the kernels call the base path
  directly, and `scripts/build.sh` adds the unit only when the IR names
  `@nish_bytes_skip_`.
- **The classes.**
  - Blank and digit are as planned.
  - The text class, `skipJsonText`, covers every byte from 0x20 to 0x7f except
    `"` and `\`. It includes 0x7f (DEL), because RFC 8259 lets DEL appear
    unescaped.
  - The text class also covers each well-formed UTF-8 sequence that ends by
    `to` (RFC 3629 §4), checked inside the kernel. So a run continues through
    a non-ASCII text, such as twitter's Japanese, without returning to Nish.
    It stops at the first ill-formed or truncated sequence, and the scalar
    check in `string` then reports that sequence with the same code and offset
    as before.
- **The surface is `nish/bytes` (Q6).** It has `skipBlank`, `skipDigits`,
  `skipJsonText` and a fourth function the plan did not name, `copyBytes`.
  - Each run clamps its range and never panics (`tests/link/std_bytes_runs`).
  - `copyBytes` panics on a range that lies outside its arrays
    (`std_bytes_copy_outside`). Its walk lowers to one `llvm.memmove`, with the
    same alias scopes as an array copy.
  - The runs are on `isPureRuntime`'s list and marked variable-time.
    `std/crypto` does not call them.
- **The guards were measured, not set at 8 to 16 bytes.**
  - `jsonTokSkipBlank` checks two bytes inline. Most gaps between tokens hold
    zero or one blank, so only an indented document's longer runs make a call.
  - `jsonTokSkipDigits` stays a loop. A number's digit runs are too short to
    repay a call.
  - `jsonTokSkipPlain` calls `skipJsonText`.
  - `stringInto` copies each run of plain bytes with `copyBytes` and decodes
    only the escapes.
- **Not done: `JsonWriter`'s escape scan.** Serialize is therefore unchanged,
  and the row's serialize condition is unmet. The scan is left as a follow-up:
  it needs a fourth class, since the writer passes bytes of 128 or more through
  unescaped without validating them.
- **One finding about measurement.** An early spike ran citm 1.415x faster than
  its base. The built change ran 1.23x to 1.31x on the same IR shape. Rebuilt
  from the built change's IR, the spike measured 1.317x against the built
  change's 1.314x, and callgrind put the two within 1% in instructions. The
  difference was code layout under LTO, not the code. A later stage that
  compares a spike with its built form should rebuild both from the same IR
  before it trusts the gap.

The A/B against `a3935f1`, the S6b head, ran 9 interleaved rounds with a noise
band of about ±3–5%, comparing minima:

| file | `a3935f1` (ns) | S6a speedup |
| --- | ---: | ---: |
| twitter.json | 1,078,537 | 1.476x |
| citm_catalog.json | 1,909,381 | 1.23x–1.31x |
| canada.json | 6,689,513 | 0.931x |

canada is about 7% slower, which is outside the band. Its strings are a few
short keys and its blanks are rare, so it gains almost nothing from the runs.
Its numbers' digits did not move to the kernel. The loss is most likely the
same layout effect, but that is not proven, and it stays recorded as a loss.
The record against `06645ecf`, which is the measure the row's bar uses, is in
[`BENCHMARKS.md`](BENCHMARKS.md#json-against-other-languages) and in the S6a row of §7's
table.

*S6b, the float parser.* What it needs:

- **Eisel–Lemire, after Lemire's fast_float.** It parses at most 19
  significant digits into a `u64`, multiplies it by a 128-bit power of five
  from a table that covers decimal exponents −342 to 308 (about 10 KB of
  `u64` pairs), and rounds. It falls back to `parseFloat` only when the
  significand has more than 19 digits: Mushtak and Lemire proved the product
  always decides the rounding for at most 19 digits ("Fast Number Parsing
  Without Fallback"), and fast_float has dropped its own fallback on it.
- **Written in Nish, in `std/json-tokenizer.ts`.** It is not a runtime
  kernel: it has no vector to gain. Node runs the same Nish code, so Node's
  `numberF64` is checked by the same tests rather than being `parseFloat`.
- **A 64×64→128 high product.** Nish has none, and `jsonTokMulHigh` builds it
  from four 32×32→64 products in `u64`. A `mulHigh` builtin is a separate,
  measured change, proposed only if callgrind shows the four-product version
  is a material part of what remains. `std/` may use a new builtin
  immediately; `src/` may not (the rolling freeze).
- **The table is generated.** `scripts/gen-json-pow5.mjs` computes it with
  BigInt, and `tests/run.js` checks the region in `std/json-tokenizer.ts` is
  byte for byte what it writes.
- **Licensing.** fast_float's table and algorithm are a port, at commit
  `0de7a21`, taken under BSL-1.0 (`std/LICENSE-fast-float`). The code keeps
  its upstream notice and has a row in THIRD_PARTY_NOTICES.md
  (.claude/licensing.md).
- **Exactness.**
  - The result is bit-for-bit `parseFloat`'s, checked as S6b's bar says.
  - Its edges each get a native check: subnormals, the largest finite value,
    the first overflow to Infinity, `-0`, 19 and 20 significant digits, and
    halfway cases on both sides.
  - The security record notes the run time is bounded per number: two table
    reads and at most two products, and the slow path is the existing
    `parseFloat` call, so nothing new is unbounded.

*S6c, the structural index: the design (Q5).* S1b is re-aimed here. It is
built only after S6a and S6b, and only if the owner accepts this design (§8,
Q5). It was written on 2026-10-23, with S6a and S6b landed. Nothing in it is
built. It decides each point the plan left open, and each decision comes with
its alternative and the measurement that would overturn it.

- **What it replaces.** After S6a, `next()` reads the bytes between tokens one
  at a time. A string makes one kernel call, however short, and the dispatch
  on each token's first byte is a Nish `switch`. simdjson's stage 1 instead
  finds every structural byte of a block in one pass, and its stage 2 jumps
  from one to the next. The rest of twitter's and citm's gap is that
  difference: a call per string and a step per byte between tokens, against
  a `ctz` per token. S6c's first step measures this: callgrind on the S6a
  head splits the instructions between the dispatch and skips the index would
  remove and the per-value work it would not. **If what can be removed cannot
  buy the bar's 1.5x on both files, the stage stops with nothing built**, as
  S5's stop rule would have stopped it.
- **The index is one bitmap: one `u64` per 64-byte block, one bit per byte.**
  A bit is set at each byte where the walker must stop:
  - a structural byte, `{ } [ ] : ,`, outside a string;
  - a quote that opens or closes a string;
  - outside a string, a byte that is neither a blank nor structural and
    follows a blank, a structural byte or a closing quote, or that begins the
    window. This is simdjson's pseudo-structural byte, and it marks where a
    number or a literal starts, together with any stray byte;
  - inside a string, every backslash and every control byte below 0x20.

  The alternative is simdjson's list of `u32` positions. It takes up to four
  bytes per input byte on a dense document, so it breaks the row's limit of
  one bit a byte plus one block. A per-block bit array keeps the limit and is
  what the walker reads.
- **It is built in chunks, ahead of the walker, not for the whole document.**
  - The tokenizer owns a fixed buffer: 64 words, the bits for 4,096 input
    bytes, plus one block of carry. It refills the buffer when the walker
    runs past it.
  - The kernel carries five pieces of state across refills:
    - whether the cut falls inside a string;
    - whether the cut follows an odd run of backslashes;
    - the class of the last byte;
    - an unfinished UTF-8 sequence;
    - the first ill-formed offset.
  - So the memory is fixed, 512 bytes plus the state, whatever the document's
    size. It is allocated once and kept across `reset`, so a server that
    parses one request after another allocates nothing.
  - A caller that stops early, such as `jsonFields` once it has its fields,
    indexes only the chunks it reads.
  - The chunk size is chosen by measurement. 4,096 is where the measurement
    starts.
  - The alternative is to index the whole window up front, which is
    simdjson's choice. It costs up to 2 MiB at the default 16 MiB total limit,
    and a full pass even when the caller stops early. It is measured beside
    the chunked index only if the chunked walker's refill check shows up in
    callgrind.
- **The kernel never decides an error.** The bitmap is a hint. The walker's
  position stays the truth, and every error is still found by today's scalar
  code, at today's offset. The walker keeps a cursor: the current word, with
  the bits below `pos` cleared. Each step does one of three things:
  - If the byte at `pos` is marked, it is the next token.
  - If the byte at `pos` is a blank, the next set bit is the next non-blank
    byte. This holds because a non-blank byte that follows a blank is always
    marked. The walker jumps to that bit with `ctz`, refilling at the end of
    a chunk.
  - Otherwise the byte at `pos` is unmarked and not a blank, as in `12é`, and
    today's code runs from `pos` and reports the error it reports now.

  After a token, the scalar code may have moved `pos` past several bits, as it
  does for a number or for a string that took the slow path. The cursor then
  clears the bits below the new `pos`.
- **What changes for each kind of token.**
  - **String.** At an opening quote `q`, the next set bit `c` decides.
    - When `c` is a quote, the string holds no escape and no control byte.
      When `c` also lies before the first ill-formed UTF-8 offset, the string
      is valid. Its decoded length is then `c - q - 1`, since a well-formed
      UTF-8 sequence decodes to itself. `string` checks that length against
      `maxStringBytes` and emits.
    - Anything else falls back to S6a's scan from `q`: a backslash, a control
      byte, an ill-formed byte, or a string longer than the limit. The
      fallback runs at S6a's speed and reports the error S6a reports.
  - **Number and literal.** These keep their scalar code, entered at the
    marked byte. S6b's parser is unchanged.
  - **Object and array.** `open` and `close` run as today, so the depth stack
    and the limit are untouched.
  - **`skipValue`.** It uses the same cursor and checks what it checks now.
- **The limits are untouched.** `reset` refuses the window and the total limit
  before any indexing happens. The depth limit is in `open`. The string limit
  is checked as described above. The number limit is in `number`.
- **The in-string mask.**
  - It is a prefix XOR over the mask of quotes that are not escaped, computed
    as a carry-less multiply by all ones on PCLMULQDQ or PMULL, with the
    in-string carry from the previous block.
  - S5's detection already asks for PCLMULQDQ and PMULL. But
    `runtime-aes.c`'s probe, `nish_aes_cpu`, asks for them in the same test
    as AES (and, on x86-64, SSSE3), and `nish_aes_hw` also applies the
    `NISH_AES` pin. So the carry-less-multiply test becomes a probe of its
    own, and both units call it. `nish_aes_hw` keeps its answer, and the
    classifier asks the new probe alone. This shares S5's detection rather
    than adding a second `cpuid` path.
  - Elsewhere, including wasm simd128, which has no carry-less multiply, the
    prefix XOR is six shifts and XORs on a `u64`.
- **Escaped quotes.** A quote is escaped when an odd run of backslashes
  precedes it. That is found with simdjson's carry arithmetic over the
  backslash mask, carrying across blocks.
  - simdjson is Apache-2.0 or MIT. A port of this routine keeps its notice and
    gets a row in `THIRD_PARTY_NOTICES.md` (`.claude/licensing.md`).
- **UTF-8.** The kernel validates the chunk with the Keiser–Lemire lookup
  ("Validating UTF-8 In Less Than One Instruction Per Byte"), as simdjson
  does, and records only the first ill-formed offset, as one `i32`.
  - That one offset is enough. Strings are bounded by ASCII quotes, and no
    UTF-8 sequence contains an ASCII byte. So every string that ends before
    the first ill-formed offset is well-formed, and any string past it takes
    the fallback.
  - The alternative is to mark every byte of 128 or more inside a string. It
    has no lookup tables, but it marks most of a CJK string, and twitter's
    text is such strings. Both are measured, and the lookup is kept only if
    it is faster on twitter and not slower on citm.
- **No body fed in pieces today.** `JsonTokenizer` takes one window, through
  `reset`, and nothing more. The chunk carry is the state a future feed would
  pass across a cut, but this design adds no feed.
- **The kernel and its meaning.**
  - It is one function in `runtime/nish.h`, which indexes the blocks of
    `[from, to)` into a buffer of words and updates a small state record.
    Its contract is `0 <= from <= to <= length`, with the output buffer large
    enough for the chunk.
  - It is a private walker in `std/json-tokenizer.ts`, recognised by module
    and name as S6a's walks are, so there is no public surface. The bitmap's
    layout and its carry are internals of the tokenizer, and a public function
    would freeze them.
  - Node runs the Nish walker. It is the meaning, and the kernel must agree
    with it on a fuzzed corpus, like `tests/simd/byte-runs.c`'s. That corpus
    puts every class boundary, every backslash run and every UTF-8 sequence at
    every offset of a block and at every chunk cut.
  - The kernel goes in its own unit, `runtime/runtime-json-index.c`, with its
    own ceiling. `runtime-bytes.c` has 233 bytes left, and the classifier will
    not fit in them. It is paired on freestanding wasm as `runtime-bytes.c`
    is.
  - It is variable-time, so it goes on `isPureRuntime`'s list with that
    marked, and `std/crypto` does not call it.
- **The bar.** It is the S6c row's bar, measured against the record S6a and S6b
  leave, which is the `bench/json-compare` record this design was written
  with.
  - Tokenize on twitter and citm is at least 1.5x faster at the minimum.
  - Typed decode of citm is faster, outside its band.
  - Canada and every other workload are not slower outside their bands.
  - Every error code and `errorAt` offset is unchanged on every JSONTestSuite
    `n_` file and the conformance corpus.
  - The verdicts, the fuzz checksum and #582's mutation-pinned boundaries are
    unchanged.
  - The order of work is S6a's: callgrind, then a spike rebuilt from the same
    IR as its built form, then the build.

This is not the C JSON parser §9 declines. The kernel answers masks; the
grammar, the limits, the errors and every value stay in `std/json-tokenizer.ts`.

**What S6 does not do.** It does not move the default target (§5), add
`nish:simd` (S3 stays on its own bar), or touch `std/json`'s older reader,
which S1 measured. Serialize beyond S6a's escape scan is out of scope: its
remaining gap is per-value work, not a byte scan.

**S7: met by #561 (Q9).** It was to come first, as the cheapest way to more
vector code this note had found: no surface, nothing withdrawn, and, per
§3.2.1, the bounds checks it removes were what kept a scalar float kernel from
the vector loop LLVM would otherwise build. #561 had already built it, as
WP15's bounds pipeline taking one more shape: a guard `i + c < w.length`, or
`i + c < n` with `n <= w.length`, records how far past `i` the length reaches,
and `w[i + k]` is proven for every `k` up to that reach. §3.2.1 gives the
measurement against its row's bar, and the bar is met: the guarded kernel is
the same binary as its `uncheckedGet` form. Of the negative cases the row
names, #561 pins two, a reach too short for `k`
(`tests/cases/arr_bounds_offset_reach`) and a sum that may be negative
(`arr_bounds_offset_floor`), and a third of its own, `--wrapping`
(`arr_bounds_offset_wrap`). The row's third, a guard on one array's length
indexing another, has no golden: the unguarded control in §3.2.1 shows the
four checks stay, and the plan adds the golden as its first stage.

S0 comes first, because every later bar is a ratio against it. S1 comes before
S3 because it is cheaper, withdraws nothing, and is aimed at the gap that was
measured. S2 is independent and can be taken at any point after S0. S3 waits
for S1, because S1's result says whether the byte half of S3 is needed at all.
S6a and S6b are independent of each other and of S2 and S3, and either can go
first; S6c waits for both, because its bar is a ratio against what they leave.

---

## 8. Decisions

The owner took Q1 to Q4 on 2026-10-09, each as recommended. Q5 and Q6 came with S6. The owner took Q6 on 2026-10-23, as recommended, and Q5's design is written and waits for the owner. Q7 to Q9 came with §7's measurement of what S2's flag costs, and the owner took them on 2026-10-16, each as recommended; Q9's stage turned out to be built already. The reason
beside each is the one the recommendation gave, and it is the reason the
decision stands on: a stage that finds it untrue comes back here before it
builds anything else.

| # | Question | Options | Decided |
| --- | --- | --- | --- |
| Q1 | The SIMD surface | (a) runtime kernels behind `std`; (b) `nish:simd` types; (c) target intrinsics; (d) auto-vectorisation and a CPU flag | **(a) first, (d) beside it, (b) on its bar, (c) declined.** (a) is S1, (d)'s flag is S2 and ships only on its bar, (b) is S3 and waits for S1's result (§7), and (c) is in §9. |
| Q2 | The default target | baseline; a newer level (`x86-64-v2`); `native` | **Baseline.** Wider code is chosen at run time in the runtime, or by an opt-in flag. |
| Q3 | Integer lanes in (b) | wrap, named so; trap, as scalars do | **Wrap, named so.** A trapping lane costs a mask reduction per operation, and wrapping by name keeps the reading class A. |
| Q4 | Vector width in (b) | 128 bits only; 128 and 256; scalable | **128 only.** It is the width every target shares, simd128 included. Wider work is the runtime's job (§3.1). |
| Q5 | S6c's structural index | a bitmask per block kept beside the document; a list of `u32` positions; not built | **Design written, awaiting the owner** (2026-10-23). With S6a and S6b landed, the design in §7 (*S6c, the structural index: the design*) proposes one bitmap per 64-byte block, built in 4 KiB chunks into a fixed buffer the tokenizer keeps across documents. The kernel only gives hints, and every error is still the scalar code's. It is built only if the owner accepts it, and only after callgrind shows that the bar is reachable. |
| Q6 | Where S6a's functions live | `nish/text`, beside `indexOfAny`; a new `nish/bytes` for `u8[]` scans | **`nish/bytes`** (2026-10-23), as recommended, because `nish/text` is about `string`s and these functions read `u8[]`. It holds `skipBlank`, `skipDigits`, `skipJsonText` and `copyBytes` ([LANGUAGE.md](LANGUAGE.md#byte-runs-skipblank-skipdigits-skipjsontext-and-copybytes-in-nishbytes)). |
| Q7 | S2's `--cpu` flag | build it with `x86-64-v3` only; build it with §3.4's levels; defer | **`x86-64-v3` only, for the module and the runtime alike** (2026-10-16). It is the one level that met the bar, and both constant-time checkers already read it cleanly; `native` can never be read, and the SVE levels fail today. Planned in [the S3a and S2 plan](../.claude/plans/wp38-s3a-cpu-flag.plan.md). |
| Q8 | S3, `nish:simd` | S7, then S3a, then decide; build S3 now; decline it now | **S3a, then decide** (2026-10-16). S7 was already built (#561), so scalar Nish reaches the vector loop for a float kernel with checked indexing; the byte half overlaps S6c's classifier; the surface is large and permanent. S3a is planned in [the S3a and S2 plan](../.claude/plans/wp38-s3a-cpu-flag.plan.md). |
| Q9 | S7, the offset-index credit | build it ahead of S2 and S3; leave it to WP15 | **Ahead of both** (2026-10-16), and found built: #561 had landed it on 2026-10-10 (§7, S7). |

---

## 9. Declined

- **Target intrinsics as a language surface** (§3.3). They are class D, and
  they are tied to one ISA.
- **A wider default target** (§5). It breaks the release binary on older
  machines, and the instruction gate and constant-time checker with it.
- **`-ffast-math` or contraction under any flag.** Its answers change with the
  optimiser, which no TypeScript reading can match.
- **A C JSON parser in the runtime.** The kernels in §3.1 are byte primitives
  any scanner can use. A whole parser in C would put `std/json` beside the
  language rather than in it, and help nothing else.
