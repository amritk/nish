# WP38: SIMD — which loops get vectors, and how a program asks for them

**Status: accepted; S0 and S1's kernel and surface landed, S1's `bench/json`
bar missed and S1b proposed, S2's bar met on a re-measurement but its flag not
built, S4 declined for now (tracking issue #516).** The owner took the
decisions in §8 on 2026-10-09, as recommended. S0's baselines are in §2.3
(#517). S1's kernel, `runtime/runtime-simd.c` (#518), and its `std/text`
function, `indexOfAny` (#519), are built. No way of moving `std/json` onto it
was reliably faster than S0 on `bench/json`, and none came near 1.5x, so
`std/json` is unchanged (§2.3); whether to design S1b, the block classifier,
is the owner's call (§7).
S2's `--cpu` flag is not built: S0's figures missed its bar, and a
re-measurement against the noise met it (§7); building it is the owner's call.
S4, the lexer on `indexOfAny`, is declined for now, because the lexer is too
small a part of the bootstrap to move it (§7). S3's bar now names the scalar
kernel it is judged against, and its operation list leaves out a fused
multiply-add, after a portable-vector benchmark's findings were checked
against LLVM 18 (§3.2.1). S3 has no flag, type or runtime
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
   not an emulator. Where one is worth having, as AES-NI may be, it goes into
   the runtime behind a function, as rule 1 does for byte search.
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
- a ceiling constant in `tests/run.js`, set at the next 256-byte boundary
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

With unchecked indexing, LLVM turns the four scalar chains into one loop
over a `<4 x float>` accumulator, `mulps` then `addps`: the code a
one-accumulator `f32x4` kernel would be. In C the same four-accumulator loop
compiles to that loop too, and ran at 0.99x the speed of one written with
SSE2 intrinsics and one `__m128` accumulator. With checked indexing, the
bounds check on each element keeps the loop scalar: its optimised IR has no
vector accumulator. For a float kernel, then, much of what
S3 could show over scalar Nish is available to scalar Nish already, and the
bounds checks stand in the way. It is (d)'s loop-shape work (§3.4) as much
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
PCLMULQDQ for `std/crypto/aes.ts`, which is bitsliced today so that no table
is ever indexed. That case belongs under §3.1 as a runtime kernel and §6's
rules. It does not need a language surface. **Declined** (§9).

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
reads each level the flag accepts (§7 S2). Refusing the flag for programs
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
| **S2** | (d): the `--cpu` flag | A **≥10%** gain at one level on at least one of nbody, vec3 or spectral, with no loss on the others. `tests/ct-asm.js` reads every level the flag accepts, and its fixtures pass at each one (§6). **Bar met on a re-measurement; not built**: see below. |
| **S3** | (b): `nish:simd` | A kernel written with it is **≥1.5x** faster than the same kernel in scalar Nish at the default target. It must do that on a numeric program from `bench/` and on a byte scan that S1's kernel cannot express (`bench/scan.ts`'s depth counting). The scalar kernel does the same work (§3.2.1): its integer arithmetic wraps where the lanes do, it has one accumulator for every lane of the vector kernel's accumulators, and it is timed under both checked and unchecked indexing, with the record saying whether it vectorised. The aligned scalar kernel can be faster than a naive one. In §3.2.1 a four-accumulator scalar dot product ran 4.2x faster than a one-accumulator one under unchecked indexing. Every operation has a golden, a negative test and a Node reading checked by a native round trip. |
| **S4** | `src/`'s lexer on S1's function, from the release after S1 | `scripts/bootstrap.sh --verify` is measurably faster, and its fixed point is reached. **Declined for now**: see below. |

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
bar gives no tolerance. The flag is not built, `tests/ct-asm.js` reads only
the baseline, and LANGUAGE.md gains no rule. It reopens on a re-measurement on
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
it. The flag is still not built: what it costs is mostly `tests/ct-asm.js`
reading every level it accepts (§6), and whether a gain on one benchmark of
three is worth that is the owner's decision.

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

S0 comes first, because every later bar is a ratio against it. S1 comes before
S3 because it is cheaper, withdraws nothing, and is aimed at the gap that was
measured. S2 is independent and can be taken at any point after S0. S3 waits
for S1, because S1's result says whether the byte half of S3 is needed at all.

---

## 8. Decisions

The owner took all four on 2026-10-09, each as recommended. The reason
beside each is the one the recommendation gave, and it is the reason the
decision stands on: a stage that finds it untrue comes back here before it
builds anything else.

| # | Question | Options | Decided |
| --- | --- | --- | --- |
| Q1 | The SIMD surface | (a) runtime kernels behind `std`; (b) `nish:simd` types; (c) target intrinsics; (d) auto-vectorisation and a CPU flag | **(a) first, (d) beside it, (b) on its bar, (c) declined.** (a) is S1, (d)'s flag is S2 and ships only on its bar, (b) is S3 and waits for S1's result (§7), and (c) is in §9. |
| Q2 | The default target | baseline; a newer level (`x86-64-v2`); `native` | **Baseline.** Wider code is chosen at run time in the runtime, or by an opt-in flag. |
| Q3 | Integer lanes in (b) | wrap, named so; trap, as scalars do | **Wrap, named so.** A trapping lane costs a mask reduction per operation, and wrapping by name keeps the reading class A. |
| Q4 | Vector width in (b) | 128 bits only; 128 and 256; scalable | **128 only.** It is the width every target shares, simd128 included. Wider work is the runtime's job (§3.1). |

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
